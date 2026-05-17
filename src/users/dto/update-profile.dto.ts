import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ example: 'New Name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 'NewPassword123',
    description: 'Min 6 chars',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;
}
