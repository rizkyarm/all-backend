import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../auth/decorators';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prismaService: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
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
    ]);
  }
}
