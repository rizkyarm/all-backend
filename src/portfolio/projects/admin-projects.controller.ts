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
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, QueryProjectDto } from './dto';
import { Roles } from '../../auth/decorators';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../common/enums';
import { SnakeToCamelValidationPipe } from '../../common/pipes/snake-to-camel-validation.pipe';

@ApiTags('Portfolio - Admin Projects')
@ApiBearerAuth()
@Controller('admin/projects')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class AdminProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

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
