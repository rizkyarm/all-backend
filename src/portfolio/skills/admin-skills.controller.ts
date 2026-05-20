import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SkillsService } from './skills.service';
import { CreateSkillDto, UpdateSkillDto } from './dto';
import { Roles } from '../../auth/decorators';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../common/enums';

@ApiTags('Portfolio - Admin Skills')
@ApiBearerAuth()
@Controller('admin/skills')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class AdminSkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  findAll() {
    return this.skillsService.findAllAdmin();
  }

  @Post()
  create(@Body() dto: CreateSkillDto) {
    return this.skillsService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSkillDto,
  ) {
    return this.skillsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.skillsService.delete(id);
  }
}
