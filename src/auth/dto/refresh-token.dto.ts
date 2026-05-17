import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ example: 'ey... (long token string)' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
