import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { UpdateProfileDto } from './dto';

const DEFAULT_PROFILE = {
  id: 0,
  name: '',
  tagline: '',
  bio: '',
  email: '',
  phone: '',
  location: '',
  avatar: null as string | null,
  cvUrl: null as string | null,
  socials: {} as Record<string, string>,
  stats: { projects: 0, clients: 0, experience: 0, coffee: 0 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ─── Public & Admin ─────────────────────────────────────────

  async getProfile() {
    const profile = await this.prisma.client.profile.findFirst();

    if (!profile) {
      return DEFAULT_PROFILE;
    }

    return this.transformProfile(profile);
  }

  // ─── Admin ──────────────────────────────────────────────────

  async updateProfile(dto: UpdateProfileDto, avatar?: Express.Multer.File) {
    const existing = await this.prisma.client.profile.findFirst();

    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.tagline !== undefined) data.tagline = dto.tagline;
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.cvUrl !== undefined) data.cvUrl = dto.cvUrl;
    if (dto.socials !== undefined) data.socials = dto.socials;
    if (dto.stats !== undefined) data.stats = dto.stats;

    // Handle avatar upload
    if (avatar) {
      // Delete old avatar if exists
      if (existing?.avatar) {
        try {
          await this.storage.deleteFile(existing.avatar);
        } catch (err) {
          this.logger.warn(`Failed to delete old avatar: ${err}`);
        }
      }
      data.avatar = await this.storage.uploadFile(
        avatar.buffer,
        avatar.originalname,
        avatar.mimetype,
        'profile/avatars',
      );
    }

    let profile;

    if (existing) {
      // Update existing profile
      profile = await this.prisma.client.profile.update({
        where: { id: existing.id },
        data,
      });
    } else {
      // Create new profile (upsert pattern for singleton)
      profile = await this.prisma.client.profile.create({
        data: {
          name: (data.name as string) || '',
          ...data,
        },
      });
    }

    this.logger.log(`Profile updated: ${profile.name}`);
    return this.transformProfile(profile);
  }

  // ─── Helpers ────────────────────────────────────────────────

  private async transformProfile(profile: Record<string, unknown>) {
    const transformed = { ...profile };

    // Convert avatar key to full URL
    if (transformed.avatar && typeof transformed.avatar === 'string') {
      try {
        transformed.avatar = await this.storage.getPresignedUrl(
          transformed.avatar as string,
        );
      } catch {
        transformed.avatar = null;
      }
    }

    return transformed;
  }
}
