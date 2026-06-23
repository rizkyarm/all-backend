import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  ParseIntPipe,
  UseGuards,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { Roles } from '../../auth/decorators';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../common/enums';

@ApiTags('Portfolio - Admin Messages')
@ApiBearerAuth()
@Controller('admin/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminMessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  findAll() {
    return this.messagesService.findAll();
  }

  @Put(':id/read')
  markAsRead(@Param('id', ParseIntPipe) id: number) {
    return this.messagesService.markAsRead(id);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.messagesService.delete(id);
  }
}
