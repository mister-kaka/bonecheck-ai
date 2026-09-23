import { IsOptional, IsString } from 'class-validator';

export class ListStudiesQueryDto {
  @IsOptional()
  @IsString({ message: 'session_id должен быть строкой.' })
  session_id?: string;
}
