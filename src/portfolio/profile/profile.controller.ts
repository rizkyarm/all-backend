import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators';
import { ProfileService } from './profile.service';

@ApiTags('Portfolio - Profile')
@Public()
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  getProfile() {
    return this.profileService.getProfile();
  }
}
