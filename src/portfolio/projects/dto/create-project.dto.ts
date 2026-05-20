import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProjectCategory {
  website = 'website',
  android = 'android',
  video = 'video',
  design = 'design',
}

export enum ProjectStatus {
  live = 'live',
  draft = 'draft',
}

export class CreateProjectDto {
  @ApiProperty({ example: 'E-Commerce App' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ enum: ProjectCategory, example: 'website' })
  @IsEnum(ProjectCategory)
  @IsNotEmpty()
  category!: ProjectCategory;

  @ApiProperty({ example: 'Full description of the project...' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ example: 'Short desc' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  shortDescription?: string;

  @ApiPropertyOptional({ example: '["react", "laravel"]' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return value;
  })
  tags?: string[];

  @ApiPropertyOptional({ example: '["Payment gateway", "Admin dashboard"]' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return value;
  })
  features?: unknown[];

  @ApiPropertyOptional({ example: '["React", "Laravel", "MySQL"]' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return value;
  })
  techStack?: string[];

  @ApiPropertyOptional({ example: 'https://demo.example.com' })
  @IsOptional()
  @IsString()
  demoUrl?: string;

  @ApiPropertyOptional({ example: 'https://github.com/user/repo' })
  @IsOptional()
  @IsString()
  repoUrl?: string;

  @ApiPropertyOptional({ enum: ProjectStatus, default: 'draft' })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;
}
