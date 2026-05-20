import { Controller, Get, Param, Query, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators';
import { ProjectsService } from './projects.service';
import { QueryProjectDto } from './dto';

@ApiTags('Portfolio - Projects')
@Public()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  findAll(@Query() query: QueryProjectDto) {
    return this.projectsService.findAllPublic(query);
  }

  @Get(':slug')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  findBySlug(@Param('slug') slug: string) {
    return this.projectsService.findBySlug(slug);
  }
}
