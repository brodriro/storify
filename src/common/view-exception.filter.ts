import {
  ArgumentsHost,
  Catch,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request, Response } from 'express';

/**
 * Page navigations (GET + Accept: text/html) get a redirect instead of a JSON
 * error body: an expired session goes to the login page, a forbidden page back
 * to the file browser. API calls (fetch, Accept: application/json) keep the
 * standard JSON errors.
 */
@Catch(UnauthorizedException, ForbiddenException)
export class ViewExceptionFilter extends BaseExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    if (host.getType() === 'http') {
      const ctx = host.switchToHttp();
      const req = ctx.getRequest<Request>();
      const res = ctx.getResponse<Response>();
      const wantsPage =
        req.method === 'GET' && req.accepts(['json', 'html']) === 'html';
      if (wantsPage) {
        if (exception instanceof UnauthorizedException) {
          res.clearCookie('jwt');
          return res.redirect('/');
        }
        return res.redirect('/files/browser');
      }
    }
    super.catch(exception, host);
  }
}
