import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto';
import { Public } from './decorators';
import { CurrentUser } from './decorators';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RawResponse } from '../common/decorators/raw-response.decorator';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';

/**
 * Admin-prefixed auth endpoints.
 *
 * The frontend (ported from Laravel) calls GET /admin/me and POST /admin/logout.
 * This controller maps those routes to the existing AuthService methods,
 * keeping the original /auth/* routes intact for backward compatibility.
 */
@ApiTags('Admin Auth')
@ApiBearerAuth()
@RawResponse()
@Controller('admin')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser('id') userId?: string) {
    if (!userId) {
      return { user: null };
    }
    return this.authService.getMe(userId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }
}
