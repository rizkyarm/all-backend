import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

/**
 * Like JwtAuthGuard but NEVER throws UnauthorizedException.
 *
 * If a valid Bearer token is present, attaches the user to request.user.
 * If no token or invalid token, request.user remains undefined.
 *
 * This is useful for endpoints like /auth/me that should silently
 * return null instead of a 401 error when the user is not logged in.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Always allow the request through
    try {
      // Try passport JWT authentication
      const result = await super.canActivate(context);
      return result as boolean;
    } catch {
      // Token absent, expired, or invalid — silently ignore
      const request = context.switchToHttp().getRequest<Request>();
      (request as any).user = null;
    }
    return true;
  }

  /**
   * Override handleRequest to never throw — passport calls this internally.
   */
  handleRequest<AuthenticatedUser>(
    err: Error | null,
    user: AuthenticatedUser | false | null,
  ): AuthenticatedUser | null {
    if (err || !user) {
      return null;
    }
    return user;
  }
}
