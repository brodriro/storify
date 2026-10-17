import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limits login attempts per client IP and target username, so guessing
 * one account's password is slow while other users on the same LAN IP (NAT)
 * can still log in.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const body = req.body as { username?: unknown } | undefined;
    const username =
      typeof body?.username === 'string' ? body.username.slice(0, 64) : '';
    return Promise.resolve(`${String(req.ip)}:${username}`);
  }
}
