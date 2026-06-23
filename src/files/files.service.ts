import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FilesService {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  async uploadFile(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is missing');
    }

    // 1. Upload to S3
    const key = await this.storageService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      'uploads',
    );

    // 2. Save metadata to database
    const fileRecord = await this.prisma.client.file.create({
      data: {
        key,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        uploaderId: userId,
      },
    });

    // 3. Get temporary presigned URL
    const url = await this.storageService.getPresignedUrl(key);

    return {
      id: fileRecord.id,
      key: fileRecord.key,
      url,
      mimetype: fileRecord.mimetype,
      size: fileRecord.size,
    };
  }

  async deleteFile(userId: string, key: string) {
    // 1. Find file in database
    const fileRecord = await this.prisma.client.file.findUnique({
      where: { key },
    });

    if (!fileRecord) {
      throw new NotFoundException('File not found');
    }

    // 2. Verify ownership (only the uploader can delete it)
    if (fileRecord.uploaderId !== userId) {
      // We could also allow ADMINs to delete it, but let's keep it simple for now
      throw new ForbiddenException('You can only delete your own files');
    }

    // 3. Delete from S3
    await this.storageService.deleteFile(key);

    // 4. Delete from database
    await this.prisma.client.file.delete({
      where: { key },
    });

    return {
      message: 'File successfully deleted',
      key,
    };
  }

  async getFileUrl(userId: string, key: string) {
    // Optional: check if file exists in DB and belongs to user
    const fileRecord = await this.prisma.client.file.findUnique({
      where: { key },
    });

    if (!fileRecord) {
      throw new NotFoundException('File not found');
    }

    // If we want files to be private to the uploader:
    if (fileRecord.uploaderId !== userId) {
      throw new ForbiddenException('You do not have access to this file');
    }

    const url = await this.storageService.getPresignedUrl(key);
    return {
      key,
      url,
      expiresIn: 3600,
    };
  }

  /**
   * Proxy a file from MinIO — public access, no auth required.
   * Used so frontend can fetch files via the API tunnel without exposing MinIO.
   */
  async streamFile(key: string): Promise<{ buffer: Buffer; mimetype: string }> {
    const buffer = await this.storageService.downloadFile(key);
    // Guess mimetype from extension
    const ext = key.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      pdf: 'application/pdf',
    };
    return { buffer, mimetype: mimeMap[ext || ''] || 'application/octet-stream' };
  }
}
