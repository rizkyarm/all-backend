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

  @Get(':slugOrId')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  findBySlugOrId(@Param('slugOrId') slugOrId: string) {
    // Try numeric ID first, then fall back to slug lookup
    const id = Number(slugOrId);
    if (!Number.isNaN(id)) {
      return this.projectsService.findByIdOrSlug(id, slugOrId);
    }
    return this.projectsService.findBySlug(slugOrId);
  }
}
