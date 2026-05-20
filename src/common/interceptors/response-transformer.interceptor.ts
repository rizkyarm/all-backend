import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response as ExpressResponse } from 'express';
import { IS_RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';

export interface StandardResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function convertCamelToSnake(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return obj;
  }

  // Do not transform file buffers or special class instances
  if (
    obj.constructor &&
    obj.constructor.name !== 'Object' &&
    obj.constructor.name !== 'Array'
  ) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(convertCamelToSnake);
  }

  return Object.keys(obj).reduce<Record<string, unknown>>((acc, key) => {
    const snakeKey = camelToSnake(key);

    acc[snakeKey] = convertCamelToSnake(obj[key]);
    return acc;
  }, {});
}

@Injectable()
export class ResponseTransformerInterceptor<T> implements NestInterceptor<
  T,
  any
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<ExpressResponse>();

    // Attach correlation ID to the response headers for tracking
    if (req.id && !res.getHeader('x-correlation-id')) {
      res.setHeader('x-correlation-id', req.id);
    }

    const isRawResponse = this.reflector.getAllAndOverride<boolean>(
      IS_RAW_RESPONSE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isRawResponse) {
      return next
        .handle()
        .pipe(map((responseData: T) => convertCamelToSnake(responseData)));
    }

    return next.handle().pipe(
      map((responseData: T) => {
        const transformedData = convertCamelToSnake(responseData);

        // If the response is already formatted with data and meta, return as is
        // (Useful for paginated responses like findAll)
        if (
          transformedData &&
          typeof transformedData === 'object' &&
          'data' in transformedData &&
          'meta' in transformedData
        ) {
          return transformedData;
        }

        // Otherwise, wrap the response in a "data" property
        return { data: transformedData };
      }),
    );
  }
}
