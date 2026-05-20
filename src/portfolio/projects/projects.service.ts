import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ─── Public ─────────────────────────────────────────────────

  async findAllPublic(query: QueryProjectDto) {
    const where: Record<string, unknown> = { status: 'live' };

    if (query.category) {
      where.category = query.category;
    }

    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }

    if (query.featured !== undefined) {
      where.isFeatured = query.featured;
    }

    const projects = await this.prisma.client.project.findMany({
      where,
      orderBy: { order: 'asc' },
    });

    return this.transformProjects(projects);
  }

  async findBySlug(slug: string) {
    const project = await this.prisma.client.project.findUnique({
      where: { slug },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.transformProject(project);
  }

  // ─── Admin ──────────────────────────────────────────────────

  async findAllAdmin(query: QueryProjectDto) {
    const where: Record<string, unknown> = {};

    if (query.category) {
      where.category = query.category;
    }

    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }

    if (query.featured !== undefined) {
      where.isFeatured = query.featured;
    }

    const projects = await this.prisma.client.project.findMany({
      where,
      orderBy: { order: 'asc' },
    });

    return this.transformProjects(projects);
  }

  async findById(id: number) {
    const project = await this.prisma.client.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.transformProject(project);
  }

  async create(
    dto: CreateProjectDto,
    thumbnail?: Express.Multer.File,
    images?: Express.Multer.File[],
  ) {
    const slug = await this.generateUniqueSlug(dto.title);

    let thumbnailKey: string | null = null;
    let imageKeys: string[] = [];

    if (thumbnail) {
      thumbnailKey = await this.storage.uploadFile(
        thumbnail.buffer,
        thumbnail.originalname,
        thumbnail.mimetype,
        'projects/thumbnails',
      );
    }

    if (images && images.length > 0) {
      imageKeys = await Promise.all(
        images.map((img) =>
          this.storage.uploadFile(
            img.buffer,
            img.originalname,
            img.mimetype,
            'projects/images',
          ),
        ),
      );
    }

    const project = await this.prisma.client.project.create({
      data: {
        title: dto.title,
        slug,
        category: dto.category,
        description: dto.description,
        shortDescription: dto.shortDescription || null,
        tags: dto.tags || [],
        features: (dto.features as any) || [],
        techStack: dto.techStack || [],
        thumbnail: thumbnailKey,
        images: imageKeys,
        demoUrl: dto.demoUrl || null,
        repoUrl: dto.repoUrl || null,
        status: dto.status || 'draft',
        isFeatured: dto.isFeatured ?? false,
        order: dto.order ?? 0,
      },
    });

    this.logger.log(`Project created: ${project.title} (${project.slug})`);
    return this.transformProject(project);
  }

  async update(
    id: number,
    dto: UpdateProjectDto,
    thumbnail?: Express.Multer.File,
    images?: Express.Multer.File[],
  ) {
    const existing = await this.prisma.client.project.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    const data: Record<string, unknown> = {};

    // Map simple fields
    if (dto.title !== undefined) {
      data.title = dto.title;
      // Re-generate slug if title changed
      data.slug = await this.generateUniqueSlug(dto.title, id);
    }
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.shortDescription !== undefined) data.shortDescription = dto.shortDescription;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.features !== undefined) data.features = dto.features;
    if (dto.techStack !== undefined) data.techStack = dto.techStack;
    if (dto.demoUrl !== undefined) data.demoUrl = dto.demoUrl;
    if (dto.repoUrl !== undefined) data.repoUrl = dto.repoUrl;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.isFeatured !== undefined) data.isFeatured = dto.isFeatured;
    if (dto.order !== undefined) data.order = dto.order;

    // Handle thumbnail replacement
    if (thumbnail) {
      // Delete old thumbnail
      if (existing.thumbnail) {
        try {
          await this.storage.deleteFile(existing.thumbnail);
        } catch (err) {
          this.logger.warn(`Failed to delete old thumbnail: ${err}`);
        }
      }
      data.thumbnail = await this.storage.uploadFile(
        thumbnail.buffer,
        thumbnail.originalname,
        thumbnail.mimetype,
        'projects/thumbnails',
      );
    }

    // Handle images replacement
    if (images && images.length > 0) {
      // Delete old images
      const oldImages = (existing.images as string[]) || [];
      for (const oldKey of oldImages) {
        try {
          await this.storage.deleteFile(oldKey);
        } catch (err) {
          this.logger.warn(`Failed to delete old image: ${err}`);
        }
      }

      data.images = await Promise.all(
        images.map((img) =>
          this.storage.uploadFile(
            img.buffer,
            img.originalname,
            img.mimetype,
            'projects/images',
          ),
        ),
      );
    }

    const project = await this.prisma.client.project.update({
      where: { id },
      data,
    });

    this.logger.log(`Project updated: ${project.title}`);
    return this.transformProject(project);
  }

  async delete(id: number) {
    const project = await this.prisma.client.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Cleanup files from storage
    if (project.thumbnail) {
      try {
        await this.storage.deleteFile(project.thumbnail);
      } catch (err) {
        this.logger.warn(`Failed to delete thumbnail: ${err}`);
      }
    }

    const projectImages = (project.images as string[]) || [];
    for (const imageKey of projectImages) {
      try {
        await this.storage.deleteFile(imageKey);
      } catch (err) {
        this.logger.warn(`Failed to delete image: ${err}`);
      }
    }

    await this.prisma.client.project.delete({ where: { id } });

    this.logger.log(`Project deleted: ${project.title}`);
    return { success: true, message: 'Project deleted successfully' };
  }

  // ─── Helpers ────────────────────────────────────────────────

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private async generateUniqueSlug(
    title: string,
    excludeId?: number,
  ): Promise<string> {
    let slug = this.generateSlug(title);

    const existing = await this.prisma.client.project.findUnique({
      where: { slug },
    });

    if (existing && existing.id !== excludeId) {
      // Append a numeric suffix to make slug unique
      let counter = 1;
      let candidateSlug = `${slug}-${counter}`;
      while (true) {
        const found = await this.prisma.client.project.findUnique({
          where: { slug: candidateSlug },
        });
        if (!found || found.id === excludeId) break;
        counter++;
        candidateSlug = `${slug}-${counter}`;
      }
      slug = candidateSlug;
    }

    return slug;
  }

  /**
   * Transform project record: convert storage keys to presigned URLs.
   */
  private async transformProject(project: Record<string, unknown>) {
    const transformed = { ...project };

    // Convert thumbnail key to full URL
    if (transformed.thumbnail && typeof transformed.thumbnail === 'string') {
      try {
        transformed.thumbnail = await this.storage.getPresignedUrl(
          transformed.thumbnail as string,
        );
      } catch {
        transformed.thumbnail = null;
      }
    }

    // Convert image keys to full URLs
    const imageKeys = (transformed.images as string[]) || [];
    if (imageKeys.length > 0) {
      transformed.images = await Promise.all(
        imageKeys.map(async (key) => {
          try {
            return await this.storage.getPresignedUrl(key);
          } catch {
            return null;
          }
        }),
      );
      transformed.images = (transformed.images as (string | null)[]).filter(
        Boolean,
      );
    }

    return transformed;
  }

  private async transformProjects(projects: Record<string, unknown>[]) {
    return Promise.all(projects.map((p) => this.transformProject(p)));
  }
}
