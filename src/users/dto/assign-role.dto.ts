import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../common/enums';

export class AssignRoleDto {
  @ApiProperty({ enum: Role, example: Role.MODERATOR })
  @IsEnum(Role, {
    message: `role must be one of: ${Object.values(Role).join(', ')}`,
  })
  @IsNotEmpty()
  role!: Role;
}
