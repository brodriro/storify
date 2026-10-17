import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Shape checks only: path semantics (containment, ACL, names) are enforced by
// AccessPolicy, the single source of truth.
const MAX_PATH = 4096;
const MAX_NAME = 255;
const MAX_BULK = 500;

export class BrowserQueryDto {
  @IsOptional() @IsString() @MaxLength(MAX_PATH) path?: string;
  @IsOptional() @IsIn(['name', 'date']) sort?: 'name' | 'date';
  @IsOptional() @IsIn(['asc', 'desc']) order?: 'asc' | 'desc';
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? undefined : Number(value),
  )
  @IsInt()
  @Min(1)
  page?: number;
}

export class FolderQueryDto {
  @IsOptional() @IsString() @MaxLength(MAX_PATH) path?: string;
}

export class PathQueryDto {
  @IsString() @MaxLength(MAX_PATH) path!: string;
}

export class PathBodyDto {
  @IsString() @MaxLength(MAX_PATH) path!: string;
}

export class UploadBodyDto {
  @IsOptional() @IsString() @MaxLength(MAX_PATH) path?: string;
}

export class MkdirDto {
  @IsOptional() @IsString() @MaxLength(MAX_PATH) path?: string;
  @IsString() @MaxLength(MAX_NAME) name!: string;
}

export class RenameDto {
  @IsString() @MaxLength(MAX_PATH) path!: string;
  @IsString() @MaxLength(MAX_NAME) newName!: string;
}

export class MoveDto {
  @IsString() @MaxLength(MAX_PATH) path!: string;
  @IsString() @MaxLength(MAX_PATH) destination!: string;
}

export class BulkDeleteDto {
  @IsArray()
  @ArrayMaxSize(MAX_BULK)
  @IsString({ each: true })
  @MaxLength(MAX_PATH, { each: true })
  paths!: string[];
}

export class BulkMoveDto extends BulkDeleteDto {
  @IsString() @MaxLength(MAX_PATH) destination!: string;
}

export class RecentQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? undefined : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? undefined : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
