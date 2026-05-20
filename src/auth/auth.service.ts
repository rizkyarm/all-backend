import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailQueue } from '../email/email.queue';
import { RegisterDto, LoginDto } from './dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { SignOptions } from 'jsonwebtoken';

const SALT_ROUNDS = 10;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface SanitizedUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly emailQueue: EmailQueue,
  ) {}

  // ─── Register ───────────────────────────────────────────────
  async register(dto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password & create user
    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.client.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    // Queue Welcome Email (Non-blocking)
    await this.emailQueue.addWelcomeEmailJob({
      to: user.email,
      subject: 'Welcome to our platform!',
      template: 'welcome',
      context: { name: user.name || 'User' },
    });

    this.logger.log(`User registered: ${user.email}`);

    return {
      user: this.sanitizeUser(user),
      token: tokens.accessToken,
      ...tokens,
    };
  }

  // ─── Login ──────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      user: this.sanitizeUser(user),
      token: tokens.accessToken,
      ...tokens,
    };
  }

  // ─── Refresh Tokens ─────────────────────────────────────────
  async refreshTokens(refreshToken: string) {
    // Check Redis blacklist first (fast path)
    const isBlacklisted = await this.redis.isTokenBlacklisted(refreshToken);
    if (isBlacklisted) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const storedToken = await this.prisma.client.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.isRevoked) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke old token: DB + Redis blacklist
    const ttlSeconds = Math.max(
      0,
      Math.floor((storedToken.expiresAt.getTime() - Date.now()) / 1000),
    );

    await Promise.all([
      this.prisma.client.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true },
      }),
      this.redis.blacklistToken(refreshToken, ttlSeconds),
      this.removeRefreshTokenFromRedis(storedToken.userId, refreshToken),
    ]);

    // Generate new token pair
    const { user } = storedToken;
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      token: tokens.accessToken,
      ...tokens,
    };
  }

  // ─── Logout ─────────────────────────────────────────────────
  async logout(refreshToken: string) {
    const storedToken = await this.prisma.client.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (storedToken) {
      // Calculate remaining TTL for Redis blacklist
      const ttlSeconds = Math.max(
        0,
        Math.floor((storedToken.expiresAt.getTime() - Date.now()) / 1000),
      );

      // Revoke in DB + blacklist + remove hash from Redis (parallel)
      await Promise.all([
        this.prisma.client.refreshToken.update({
          where: { id: storedToken.id },
          data: { isRevoked: true },
        }),
        this.redis.blacklistToken(refreshToken, ttlSeconds),
        this.removeRefreshTokenFromRedis(storedToken.userId, refreshToken),
      ]);
    }

    return { message: 'Logout berhasil' };
  }

  // ─── Get Current User ───────────────────────────────────────
  async getMe(userId: string): Promise<{ user: SanitizedUser }> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return { user: this.sanitizeUser(user) };
  }

  // ─── Helpers ────────────────────────────────────────────────
  private async generateTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<TokenPair> {
    const payload = { sub: userId, email, role };
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET')!;
    const expiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret,
        expiresIn: expiresIn as SignOptions['expiresIn'],
      }),
      // Refresh token is an opaque random string, not a JWT
      Promise.resolve(crypto.randomUUID()),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, token: string) {
    const expiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';
    const expiresAt = this.calculateExpiry(expiresIn);

    // Hash token for Redis storage
    const tokenHash = this.hashToken(token);
    const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;

    // Store in DB + Redis (parallel)
    await Promise.all([
      this.prisma.client.refreshToken.create({
        data: {
          token,
          userId,
          expiresAt,
        },
      }),
      // Store hash in Redis with 30-day TTL: rt:<userId>:<hash> = token
      this.redis.set(
        `rt:${userId}:${tokenHash}`,
        token,
        THIRTY_DAYS_IN_SECONDS,
      ),
    ]);
  }

  /**
   * Remove a refresh token hash from Redis.
   */
  private async removeRefreshTokenFromRedis(userId: string, token: string) {
    const tokenHash = this.hashToken(token);
    await this.redis.del(`rt:${userId}:${tokenHash}`);
  }

  /**
   * SHA-256 hash of a token for safe Redis storage.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private calculateExpiry(duration: string): Date {
    const now = new Date();
    const match = duration.match(/^(\d+)([smhd])$/);

    if (!match) {
      // Default 7 days
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return new Date(now.getTime() + value * 1000);
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  private sanitizeUser(user: {
    password: string;
    [key: string]: unknown;
  }): SanitizedUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...sanitized } = user;
    return sanitized as unknown as SanitizedUser;
  }
}
