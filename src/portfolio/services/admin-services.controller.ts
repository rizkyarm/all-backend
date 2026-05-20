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
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto } from './dto';
import { Roles } from '../../auth/decorators';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../common/enums';

@ApiTags('Portfolio - Admin Services')
@ApiBearerAuth()
@Controller('admin/services')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class AdminServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  findAll() {
    return this.servicesService.findAllAdmin();
  }

  @Post()
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.servicesService.delete(id);
  }
}
