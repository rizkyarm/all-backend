import {
  Controller,
  Get,
  Put,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto';
import { Roles } from '../../auth/decorators';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../common/enums';
import { SnakeToCamelValidationPipe } from '../../common/pipes/snake-to-camel-validation.pipe';

@ApiTags('Portfolio - Admin Profile')
@ApiBearerAuth()
@Controller('admin/profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  getProfile() {
    return this.profileService.getProfile();
  }

  @Put()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('avatar'))
  updateProfile(
    @Body(
      new SnakeToCamelValidationPipe({
        whitelist: true,
        transform: true,
      }),
    )
    dto: UpdateProfileDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.profileService.updateProfile(dto, avatar);
  }
}
