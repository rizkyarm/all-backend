import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto';

@ApiTags('Portfolio - Messages')
@Public()
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @Throttle({ default: { ttl: 60000, limit: 2 } })
  create(@Body() dto: CreateMessageDto) {
    return this.messagesService.create(dto);
  }
}
