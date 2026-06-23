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
  private s3PublicClient: S3Client;
  private readonly logger = new Logger(StorageService.name);
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT')!;
    const port = this.configService.get<number>('MINIO_PORT');
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY')!;
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY')!;
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME')!;
    const useSsl = this.configService.get<string>('MINIO_USE_SSL') === 'true';

    // Strip accidental https:// or http:// prefix from hostname
    const cleanHost = (h: string) =>
      h.replace(/^https?:\/\//, '').replace(/\/$/, '');

    const protocol = useSsl ? 'https' : 'http';

    // Build the S3 endpoint URL.
    // For Supabase Storage (SSL): https://<project-ref>.supabase.co/storage/v1/s3
    // For MinIO local (HTTP):    http://minio:9000
    const buildEndpoint = (host: string, p: number | undefined): string => {
      const base = `${protocol}://${host}`;
      const needsPort = p && p !== 443 && p !== 80;
      // Supabase uses /storage/v1/s3 path, MinIO does not
      const suffix = useSsl ? '/storage/v1/s3' : '';
      return needsPort ? `${base}:${p}${suffix}` : `${base}${suffix}`;
    };

    const baseConfig = {
      region: this.configService.get<string>('MINIO_REGION') || 'us-east-1',
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true as const,
        // Prevent indefinite hangs — fail fast on network issues
      requestTimeout: 30_000, // 30 detik per request
    };

    // Internal client: used for upload / delete / bucket management
    this.s3Client = new S3Client({
      ...baseConfig,
      endpoint: buildEndpoint(cleanHost(endpoint), port),
    });

    // Public client: used for pre-signed URLs that the browser will call
    const publicEndpoint =
      this.configService.get<string>('MINIO_PUBLIC_ENDPOINT') || endpoint;
    const publicPort =
      this.configService.get<number>('MINIO_PUBLIC_PORT') || port;
    this.s3PublicClient = new S3Client({
      ...baseConfig,
      endpoint: buildEndpoint(cleanHost(publicEndpoint), publicPort),
    });

    this.logger.log(
      `Storage: internal=${endpoint}:${port} public=${publicEndpoint}:${publicPort} ssl=${useSsl}`,
    );
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
        // Supabase: bucket must be created manually via Dashboard → Storage
        // MinIO local: auto-create
        const useSsl =
          this.configService.get<string>('MINIO_USE_SSL') === 'true';
        if (useSsl) {
          this.logger.warn(
            `Bucket '${this.bucketName}' not found. Please create it manually in Supabase Dashboard → Storage.`,
          );
        } else {
          this.logger.log(
            `Bucket '${this.bucketName}' not found. Creating...`,
          );
          await this.s3Client.send(
            new CreateBucketCommand({ Bucket: this.bucketName }),
          );
          this.logger.log(`Bucket '${this.bucketName}' created successfully.`);
        }
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
        'Could not upload file to storage: ' + err.message,
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

      return await getSignedUrl(this.s3PublicClient, command, { expiresIn });
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
   * Downloads a file from the bucket and returns its buffer.
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const response = await this.s3Client.send(command);
      // Convert readable stream to Buffer
      const chunks: Buffer[] = [];
      if (response.Body) {
        for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
          chunks.push(Buffer.from(chunk));
        }
      }
      return Buffer.concat(chunks);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to download file: ${err.message}`, err.stack);
      throw new InternalServerErrorException('Could not download file');
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
