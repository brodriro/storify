import { Controller, Post, Body, Res, UnauthorizedException, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { FileSystemService } from '../filesystem/filesystem.service';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private fileSystemService: FileSystemService
    ) { }

    @Post('login')
    async login(@Body() body, @Res() res: Response): Promise<void> {
        const user = await this.authService.validateUser(body.username, body.password);
        if (!user) {
            // Redirect to login with error
            return res.redirect('/?error=invalid');
        }

        // Ensure user folder exists (creates if doesn't exist)
        this.fileSystemService.getUserPath(user.username);

        const token = await this.authService.login(user); // returns { access_token }

        // Set cookie
        res.cookie('jwt', token.access_token, {
            httpOnly: true,
            secure: false, // Set true if https
            sameSite: 'strict',
        });

        // Redirect to file browser
        return res.redirect('/files/browser');
    }

    @Post('logout')
    async logout(@Res() res: Response): Promise<void> {
        res.clearCookie('jwt');
        return res.redirect('/');
    }
}
