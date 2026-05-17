import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
  DiskHealthIndicator,
  MicroserviceHealthIndicator,
} from '@nestjs/terminus';
import { Transport, RedisOptions } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private prisma: PrismaHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private microservice: MicroserviceHealthIndicator,
    private prismaService: PrismaService,
    private configService: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Check if external internet connection works
      () => this.http.pingCheck('internet', 'https://1.1.1.1'),

      // Check Database Connection
      () => this.prisma.pingCheck('database', this.prismaService.client),

      // Check if Memory Heap usage is below 150MB
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),

      // Check Disk Storage (Fail if > 90% used on root path)
      () =>
        this.disk.checkStorage('disk_storage', {
          path: '/',
          thresholdPercent: 0.9,
        }),

      // Check Redis Connection
      () =>
        this.microservice.pingCheck<RedisOptions>('redis', {
          transport: Transport.REDIS,
          options: {
            host: this.configService.get<string>('REDIS_HOST'),
            port: this.configService.get<number>('REDIS_PORT'),
          },
        }),
    ]);
  }
}
