import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMessageDto } from './dto';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Public ─────────────────────────────────────────────────

  async create(dto: CreateMessageDto) {
    const message = await this.prisma.client.message.create({
      data: {
        name: dto.name,
        email: dto.email,
        subject: dto.subject || null,
        body: dto.body,
      },
    });

    this.logger.log(`New message from: ${message.name} (${message.email})`);
    return { success: true, message: 'Pesan berhasil dikirim' };
  }

  // ─── Admin ──────────────────────────────────────────────────

  async findAll() {
    return this.prisma.client.message.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(id: number) {
    const existing = await this.prisma.client.message.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Message not found');
    }

    const message = await this.prisma.client.message.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    this.logger.log(`Message marked as read: ${message.id}`);
    return message;
  }

  async delete(id: number) {
    const existing = await this.prisma.client.message.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Message not found');
    }

    await this.prisma.client.message.delete({ where: { id } });

    this.logger.log(`Message deleted: ${id}`);
    return { success: true, message: 'Message deleted successfully' };
  }
}
