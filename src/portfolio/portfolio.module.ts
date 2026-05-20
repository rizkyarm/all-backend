import { Module } from '@nestjs/common';
import { ProjectsModule } from './projects/projects.module';
import { SkillsModule } from './skills/skills.module';
import { ServicesModule } from './services/services.module';
import { MessagesModule } from './messages/messages.module';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [
    ProjectsModule,
    SkillsModule,
    ServicesModule,
    MessagesModule,
    ProfileModule,
  ],
})
export class PortfolioModule {}
