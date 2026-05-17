import {
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private s3Client: S3Client;
  private readonly logger = new Logger(StorageService.name);
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT');
    const port = this.configService.get<number>('MINIO_PORT');
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY');
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME')!;

    // For local MinIO, we need HTTP. In production S3, it would be HTTPS.
    const s3Endpoint = `http://${endpoint}:${port}`;

    this.s3Client = new S3Client({
      region: 'us-east-1', // MinIO ignores this, but SDK requires a value
      endpoint: s3Endpoint,
      credentials: {
        accessKeyId: accessKey!,
        secretAccessKey: secretKey!,
      },
      forcePathStyle: true, // Crucial for MinIO compatibility
    });
  }

  async onModuleInit() {
    this.logger.log(
      `StorageService initialized. Checking bucket: ${this.bucketName}`,
    );
    try {
      await this.s3Client.send(
        new HeadBucketCommand({ Bucket: this.bucketName }),
      );
      this.logger.log(`Bucket '${this.bucketName}' is ready.`);
    } catch (error: unknown) {
      const s3Error = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
        message?: string;
        stack?: string;
      };
      if (
        s3Error.name === 'NotFound' ||
        s3Error.$metadata?.httpStatusCode === 404
      ) {
        this.logger.log(`Bucket '${this.bucketName}' not found. Creating...`);
        await this.s3Client.send(
          new CreateBucketCommand({ Bucket: this.bucketName }),
        );
        this.logger.log(`Bucket '${this.bucketName}' created successfully.`);
      } else {
        this.logger.error(
          `Error checking bucket: ${s3Error.message}`,
          s3Error.stack,
        );
      }
    }
  }

  /**
   * Uploads a file to the S3/MinIO bucket.
   * @param fileBuffer The buffer of the file
   * @param originalName The original filename
   * @param mimetype The MIME type of the file
   * @param folder The target folder inside the bucket
   * @returns The generated key (filename) in the bucket
   */
  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    mimetype: string,
    folder = 'uploads',
  ): Promise<string> {
    try {
      const ext = path.extname(originalName);
      const filename = `${folder}/${uuidv4()}${ext}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filename,
        Body: fileBuffer,
        ContentType: mimetype,
      });

      await this.s3Client.send(command);
      return filename;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to upload file: ${err.message}`, err.stack);
      throw new InternalServerErrorException(
        'Could not upload file to storage',
      );
    }
  }

  /**
   * Generates a temporary, pre-signed URL to access a private file.
   * @param key The file key (e.g., 'uploads/123.jpg')
   * @param expiresIn Expiration time in seconds (default 1 hour)
   */
  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Failed to generate presigned URL: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException('Could not generate file URL');
    }
  }

  /**
   * Deletes a file from the bucket.
   * @param key The file key
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to delete file: ${err.message}`, err.stack);
      throw new InternalServerErrorException(
        'Could not delete file from storage',
      );
    }
  }
}
