import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Public ─────────────────────────────────────────────────

  async findAllPublic() {
    return this.prisma.client.service.findMany({
      where: { isVisible: true },
      orderBy: { order: 'asc' },
    });
  }

  // ─── Admin ──────────────────────────────────────────────────

  async findAllAdmin() {
    return this.prisma.client.service.findMany({
      orderBy: { order: 'asc' },
    });
  }

  async create(dto: CreateServiceDto) {
    const service = await this.prisma.client.service.create({
      data: {
        title: dto.title,
        description: dto.description,
        icon: dto.icon || null,
        priceRange: dto.priceRange || null,
        includes: dto.includes || [],
        color: dto.color || null,
        featured: dto.featured ?? false,
        order: dto.order ?? 0,
        isVisible: dto.isVisible ?? true,
      },
    });

    this.logger.log(`Service created: ${service.title}`);
    return service;
  }

  async update(id: number, dto: UpdateServiceDto) {
    const existing = await this.prisma.client.service.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Service not found');
    }

    const service = await this.prisma.client.service.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Service updated: ${service.title}`);
    return service;
  }

  async delete(id: number) {
    const existing = await this.prisma.client.service.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Service not found');
    }

    await this.prisma.client.service.delete({ where: { id } });

    this.logger.log(`Service deleted: ${existing.title}`);
    return { success: true, message: 'Service deleted successfully' };
  }
}
