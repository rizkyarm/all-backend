import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  Header,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, QueryProjectDto } from './dto';
import { Roles } from '../../auth/decorators';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../common/enums';
import { SnakeToCamelValidationPipe } from '../../common/pipes/snake-to-camel-validation.pipe';

@ApiTags('Portfolio - Admin Projects')
@ApiBearerAuth()
@Controller('admin/projects')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  private readonly ALLOWED_IMAGE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'image/avif',
  ];
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  /** Validate uploaded image files */
  private validateFiles(files?: Express.Multer.File[]) {
    if (!files || files.length === 0) return;
    for (const f of files) {
      if (f.size > this.MAX_FILE_SIZE) {
        throw new BadRequestException(
          `File "${f.originalname}" too large. Max ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
        );
      }
      if (!this.ALLOWED_IMAGE_TYPES.includes(f.mimetype)) {
        throw new BadRequestException(
          `File "${f.originalname}" has unsupported type: ${f.mimetype}. Allowed: PNG, JPEG, WebP, GIF, SVG, AVIF`,
        );
      }
    }
  }

  @Get()
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  findAll(@Query() query: QueryProjectDto) {
    return this.projectsService.findAllAdmin(query);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findById(id);
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'thumbnail', maxCount: 1 },
      { name: 'images', maxCount: 10 },
    ]),
  )
  create(
    @Body(
      new SnakeToCamelValidationPipe({
        whitelist: true,
        transform: true,
        // omit forbidNonWhitelisted – multipart form data may carry extra fields
      }),
    )
    dto: CreateProjectDto,
    @UploadedFiles()
    files: {
      thumbnail?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
  ) {
    this.validateFiles(files?.thumbnail);
    this.validateFiles(files?.images);
    return this.projectsService.create(
      dto,
      files?.thumbnail?.[0],
      files?.images,
    );
  }

  @Put(':id')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'thumbnail', maxCount: 1 },
      { name: 'images', maxCount: 10 },
    ]),
  )
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(
      new SnakeToCamelValidationPipe({
        whitelist: true,
        transform: true,
      }),
    )
    dto: UpdateProjectDto,
    @UploadedFiles()
    files: {
      thumbnail?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
  ) {
    this.validateFiles(files?.thumbnail);
    this.validateFiles(files?.images);
    return this.projectsService.update(
      id,
      dto,
      files?.thumbnail?.[0],
      files?.images,
    );
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'thumbnail', maxCount: 1 },
      { name: 'images', maxCount: 10 },
    ]),
  )
  partialUpdate(
    @Param('id', ParseIntPipe) id: number,
    @Body(
      new SnakeToCamelValidationPipe({
        whitelist: true,
        transform: true,
      }),
    )
    dto: UpdateProjectDto,
    @UploadedFiles()
    files: {
      thumbnail?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
  ) {
    this.validateFiles(files?.thumbnail);
    this.validateFiles(files?.images);
    return this.projectsService.update(
      id,
      dto,
      files?.thumbnail?.[0],
      files?.images,
    );
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.delete(id);
  }
}
