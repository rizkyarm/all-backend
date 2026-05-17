import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response as ExpressResponse } from 'express';

export interface StandardResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class ResponseTransformerInterceptor<T> implements NestInterceptor<
  T,
  StandardResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<ExpressResponse>();

    // Attach correlation ID to the response headers for tracking
    if (req.id && !res.getHeader('x-correlation-id')) {
      res.setHeader('x-correlation-id', req.id);
    }

    return next.handle().pipe(
      map((responseData: T) => {
        // If the response is already formatted with data and meta, return as is
        // (Useful for paginated responses like findAll)
        if (
          responseData &&
          typeof responseData === 'object' &&
          'data' in responseData &&
          'meta' in responseData
        ) {
          return responseData as unknown as StandardResponse<T>;
        }

        // Otherwise, wrap the response in a "data" property
        return { data: responseData };
      }),
    );
  }
}
