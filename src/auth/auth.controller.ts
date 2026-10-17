import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { LogsService } from '../agent/logs/logs.service';
import type { AppConfig } from '../config/configuration';
import { FileSystemService } from '../filesystem/filesystem.service';
import { SESSION_TTL_SECONDS } from './auth.constants';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly fileSystemService: FileSystemService,
    private readonly logsService: LogsService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Post('login')
  async login(
    @Body() body: { username?: unknown; password?: unknown },
    @Res() res: Response,
  ): Promise<void> {
    const user = this.authService.validateUser(body.username, body.password);
    if (!user) {
      await this.logsService.recordEvent('login_failure', {
        username:
          typeof body.username === 'string'
            ? body.username.slice(0, 64)
            : undefined,
      });
      return res.redirect('/?error=invalid');
    }

    await this.logsService.recordEvent('login_success', {
      username: user.username,
    });
    if (user.role !== 'guest') {
      // Ensure the user's home folder exists
      this.fileSystemService.getUserPath(user.username);
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
