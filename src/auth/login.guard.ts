import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LoginGuard extends AuthGuard('jwt') {
    async canActivate(context: ExecutionContext) {
        try {
            const result = await super.canActivate(context);
            return false; // If logged in, return false so we can handle redirection in controller (or throw specific error)
        } catch (e) {
            return true; // Not logged in, allow access to login page
        }
    }

    // This is tricky. simpler: check if user exists. 
    // If user is verified, redirect to /browser.
}
