import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: unknown, user: TUser | false): TUser {
    if (err instanceof Error) throw err;
    if (err || !user) throw new UnauthorizedException();
    return user;
  }
}
