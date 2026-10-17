import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Lenient on purpose: missing fields are a failed login (redirect), not a 400. */
export class LoginDto {
  @IsOptional() @IsString() @MaxLength(128) username?: string;
  @IsOptional() @IsString() @MaxLength(1024) password?: string;
}
