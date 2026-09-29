import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListStudiesQueryDto {
  @IsOptional()
  @IsString({ message: 'session_id должен быть строкой.' })
  session_id?: string;
}

export class ExportStudiesQueryDto {
  @IsOptional()
  @IsString()
  ids?: string;

  @IsOptional()
  @IsString({ message: 'session_id должен быть строкой.' })
  session_id?: string;
}

export class SubmissionQueryDto extends ExportStudiesQueryDto {
  @IsOptional()
  @IsIn(['xlsx', 'csv'], { message: 'format должен быть xlsx или csv.' })
  format?: 'xlsx' | 'csv';
}
