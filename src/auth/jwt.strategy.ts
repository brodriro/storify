import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (request: any) => {
                    return request?.cookies?.jwt;
                },
            ]),
            ignoreExpiration: false,
            secretOrKey: configService.get('JWT_SECRET') || 'secretKey',
        });
    }

    async validate(payload: any) {
        return { username: payload.username, roles: payload.roles };
    }
}
