import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuditService } from '../audit/audit.service';
import type { AppConfig } from '../config/configuration';
import { StorageService } from '../storage/storage.service';
import { SESSION_TTL_SECONDS } from './auth.constants';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { LoginThrottlerGuard } from './login-throttler.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Post('login')
  @UseGuards(LoginThrottlerGuard)
  async login(@Body() body: LoginDto, @Res() res: Response): Promise<void> {
    const user = this.authService.validateUser(body.username, body.password);
    if (!user) {
      await this.auditService.recordEvent('login_failure', {
        username:
          typeof body.username === 'string'
            ? body.username.slice(0, 64)
            : undefined,
      });
      return res.redirect('/?error=invalid');
    }

    await this.auditService.recordEvent('login_success', {
      username: user.username,
    });
    if (user.role !== 'guest') {
      // Ensure the user's home folder exists
      this.storageService.getUserPath(user.username);
    }

    res.cookie('jwt', this.authService.login(user).access_token, {
      httpOnly: true,
      secure: this.configService.get('cookieSecure', { infer: true }),
      sameSite: 'strict',
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
    return res.redirect('/files/browser');
  }

  @Get('logout')
  @Post('logout')
  logout(@Res() res: Response): void {
    res.clearCookie('jwt');
    return res.redirect('/');
  }
}
