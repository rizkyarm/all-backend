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
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private s3Client!: S3Client;
  private s3PublicClient!: S3Client;
  private supabase: SupabaseClient | null = null;
  private readonly logger = new Logger(StorageService.name);
  private readonly bucketName: string;
  private readonly useSupabase: boolean;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT')!;
    const port = this.configService.get<number>('MINIO_PORT');
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY')!;
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY')!;
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME')!;
    this.useSupabase =
      this.configService.get<string>('MINIO_USE_SSL') === 'true';

    if (this.useSupabase) {
      const supabaseUrl = `https://${endpoint}`;
      this.supabase = createClient(supabaseUrl, secretKey, {
        auth: { persistSession: false },
      });
      this.logger.log(
        `Storage: mode=supabase url=${supabaseUrl} bucket=${this.bucketName}`,
      );
    } else {
      const cleanHost = (h: string) =>
        h.replace(/^https?:\/\//, '').replace(/\/$/, '');

      const buildEndpoint = (host: string, p: number | undefined): string => {
        const base = `http://${host}`;
        const needsPort = p && p !== 80;
        return needsPort ? `${base}:${p}` : base;
      };

      const baseConfig = {
        region: 'us-east-1' as const,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
        forcePathStyle: true as const,
        requestTimeout: 30_000,
      };

      this.s3Client = new S3Client({
        ...baseConfig,
        endpoint: buildEndpoint(cleanHost(endpoint), port),
      });

      const publicEndpoint =
        this.configService.get<string>('MINIO_PUBLIC_ENDPOINT') || endpoint;
      const publicPort =
        this.configService.get<number>('MINIO_PUBLIC_PORT') || port;
      this.s3PublicClient = new S3Client({
        ...baseConfig,
        endpoint: buildEndpoint(cleanHost(publicEndpoint), publicPort),
      });

      this.logger.log(
        `Storage: mode=minio internal=${endpoint}:${port} public=${publicEndpoint}:${publicPort}`,
      );
    }
  }

  async onModuleInit() {
    if (this.useSupabase) {
      this.logger.log('Storage: Supabase native client ready');
      return;
    }

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
        this.logger.error(`Error checking bucket: ${s3Error.message}`);
      }
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    mimetype: string,
    folder = 'uploads',
  ): Promise<string> {
    try {
      const ext = path.extname(originalName);
      const filename = `${folder}/${uuidv4()}${ext}`;

      if (this.useSupabase && this.supabase) {
        const { data, error } = await this.supabase.storage
          .from(this.bucketName)
          .upload(filename, fileBuffer, {
            contentType: mimetype,
            upsert: false,
          });

        if (error) throw error;
        return data!.path;
      }

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filename,
        Body: fileBuffer,
        ContentType: mimetype,
      });
      await this.s3Client.send(command);
      return filename;
    } catch (error: unknown) {
      const err = error as Error & { statusCode?: number };
      this.logger.error(`Failed to upload file: ${err.message}`, err.stack);
      throw new InternalServerErrorException(
        'Could not upload file to storage: ' + err.message,
      );
    }
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    try {
      if (this.useSupabase && this.supabase) {
        const { data, error } = await this.supabase.storage
          .from(this.bucketName)
          .createSignedUrl(key, expiresIn);

        if (error) throw error;
        return data!.signedUrl;
      }

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

  async downloadFile(key: string): Promise<Buffer> {
    try {
      if (this.useSupabase && this.supabase) {
        const { data, error } = await this.supabase.storage
          .from(this.bucketName)
          .download(key);

        if (error) throw error;
        return Buffer.from(await data!.arrayBuffer());
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const response = await this.s3Client.send(command);
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

  async deleteFile(key: string): Promise<void> {
    try {
      if (this.useSupabase && this.supabase) {
        const { error } = await this.supabase.storage
          .from(this.bucketName)
          .remove([key]);

        if (error) throw error;
        return;
      }

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
