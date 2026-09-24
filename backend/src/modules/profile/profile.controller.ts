import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ example: 'demo-user' })
  id!: string;

  @ApiProperty({ example: 'Пользователь' })
  name!: string;

  @ApiProperty({ example: 'user' })
  role!: string;
}

@ApiTags('profile')
@Controller('api/profile')
export class ProfileController {
  @Get()
  @ApiOperation({
    summary: 'Получить профиль пользователя для интерфейса',
  })
  @ApiOkResponse({
    type: UserProfileDto,
  })
  getProfile(): UserProfileDto {
    return {
      id: 'demo-user',
      name: 'Пользователь',
      role: 'user',
    };
  }
}