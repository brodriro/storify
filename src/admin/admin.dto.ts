import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBackupDto {
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isIncremental?: boolean;
}

export class DownloadBackupQueryDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
}
