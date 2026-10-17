import { IsString, MaxLength } from 'class-validator';

export class ClassifyDto {
  @IsString() @MaxLength(4096) path!: string;
}
