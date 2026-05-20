import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSkillDto, UpdateSkillDto } from './dto';

@Injectable()
export class SkillsService {
  private readonly logger = new Logger(SkillsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Public ─────────────────────────────────────────────────

  async findAllPublic() {
    return this.prisma.client.skill.findMany({
      where: { isVisible: true },
      orderBy: { order: 'asc' },
    });
  }

  // ─── Admin ──────────────────────────────────────────────────

  async findAllAdmin() {
    return this.prisma.client.skill.findMany({
      orderBy: { order: 'asc' },
    });
  }

  async create(dto: CreateSkillDto) {
    const skill = await this.prisma.client.skill.create({
      data: {
        name: dto.name,
        category: dto.category,
        icon: dto.icon || null,
        color: dto.color || null,
        level: dto.level ?? 80,
        order: dto.order ?? 0,
        isVisible: dto.isVisible ?? true,
      },
    });

    this.logger.log(`Skill created: ${skill.name}`);
    return skill;
  }

  async update(id: number, dto: UpdateSkillDto) {
    const existing = await this.prisma.client.skill.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Skill not found');
    }

    const skill = await this.prisma.client.skill.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Skill updated: ${skill.name}`);
    return skill;
  }

  async delete(id: number) {
    const existing = await this.prisma.client.skill.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Skill not found');
    }

    await this.prisma.client.skill.delete({ where: { id } });

    this.logger.log(`Skill deleted: ${existing.name}`);
    return { success: true, message: 'Skill deleted successfully' };
  }
}
