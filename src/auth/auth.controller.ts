import { Controller, Post, Body, Res, UnauthorizedException, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    async login(@Body() body, @Res() res: Response): Promise<Response<any, Record<string, any>>> {
        const user = await this.authService.validateUser(body.username, body.password);
        if (!user) {
            throw new UnauthorizedException();
        }
        const token = await this.authService.login(user); // returns { access_token }

        // Set cookie
        res.cookie('jwt', token.access_token, {
            httpOnly: true,
            secure: false, // Set true if https
            sameSite: 'strict',
        });

        return res.send({ success: true, user: { username: user.username, roles: user.roles } });
    }

    @Post('logout')
    async logout(@Res() res: Response) {
        res.clearCookie('jwt');
        return res.send({ success: true });
    }
}
