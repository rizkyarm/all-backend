import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto, AssignRoleDto } from './dto';
import { PaginationDto } from '../common/dto';
import { paginate, PaginatedResult } from '../common/helpers';
import type { PrismaModelDelegate } from '../common/helpers/pagination.helper';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export interface SanitizedUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Get Current User Profile ───────────────────────────────
  async getProfile(userId: string): Promise<SanitizedUser> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.sanitizeUser(user);
  }

  // ─── Update Current User Profile ────────────────────────────
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<SanitizedUser> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: Record<string, string> = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }

    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }

    const updatedUser = await this.prisma.client.user.update({
      where: { id: userId },
      data: updateData,
    });

    this.logger.log(`User profile updated: ${updatedUser.email}`);

    return this.sanitizeUser(updatedUser);
  }

  // ─── Assign Role (Admin Only) ───────────────────────────────
  async assignRole(
    targetUserId: string,
    dto: AssignRoleDto,
    adminId: string,
  ): Promise<SanitizedUser> {
    // Prevent admin from changing their own role
    if (targetUserId === adminId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    const targetUser = await this.prisma.client.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.client.user.update({
      where: { id: targetUserId },
      data: { role: dto.role },
    });

    this.logger.log(
      `Role updated: ${updatedUser.email} → ${updatedUser.role} (by admin ${adminId})`,
    );

    return this.sanitizeUser(updatedUser);
  }

  // ─── List All Users (Admin Only) ────────────────────────────
  async findAll(dto: PaginationDto): Promise<PaginatedResult<SanitizedUser>> {
    const where: Record<string, unknown> = {};
    if (dto.search) {
      where.OR = [
        { email: { contains: dto.search, mode: 'insensitive' } },
        { name: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    return paginate<SanitizedUser>(
      this.prisma.client.user as unknown as PrismaModelDelegate,
      dto,
      {
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    );
  }

  // ─── Helpers ────────────────────────────────────────────────
  private sanitizeUser(user: {
    password: string;
    [key: string]: unknown;
  }): SanitizedUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...sanitized } = user;
    return sanitized as unknown as SanitizedUser;
  }
}
