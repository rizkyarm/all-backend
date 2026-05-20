import {
  IsString,
  IsOptional,
  IsObject,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Rizki Aditiya Ramadan' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'Creative Developer & Digital Creator' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tagline?: string;

  @ApiPropertyOptional({ example: 'Saya adalah...' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 'rizki@portfolio.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '+62 812 3456 7890' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  phone?: string;

  @ApiPropertyOptional({ example: 'Bandar Lampung, Lampung' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({ example: 'cv-rizki.pdf' })
  @IsOptional()
  @IsString()
  cvUrl?: string;

  @ApiPropertyOptional({
    example: {
      linkedin: 'linkedin.com/in/rizki',
      github: 'github.com/rizki',
      youtube: 'youtube.com/@rizki',
      instagram: 'instagram.com/rizki',
      twitter: 'twitter.com/rizki',
      website: 'rizki.dev',
    },
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }
    return value;
  })
  @IsObject()
  socials?: Record<string, string>;

  @ApiPropertyOptional({
    example: { projects: 24, clients: 18, experience: 3, coffee: 1000 },
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }
    return value;
  })
  @IsObject()
  stats?: Record<string, number>;
}
