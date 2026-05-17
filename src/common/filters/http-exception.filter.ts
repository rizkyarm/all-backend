import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ExceptionResponseObject {
  message?: string;
  error?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    let message = 'Internal server error';
    let error =
      exception instanceof Error
        ? exception.name.replace('Exception', '')
        : 'Internal Server Error';

    // Parse the default NestJS exception response (can be string or object)
    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const responseObj = exceptionResponse as ExceptionResponseObject;
      message = responseObj.message || message;
      error = responseObj.error || error;
    }

    // In Express with pino-http, the req.id is set on the request object.
    const reqId = (request as Request & { id?: string }).id;
    if (reqId && !response.getHeader('x-correlation-id')) {
      response.setHeader('x-correlation-id', reqId);
    }

    if (status === 500) {
      this.logger.error(
        `[${reqId || 'NO-REQ-ID'}] ${request.method} ${request.url} - ${status} - ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
      correlationId: reqId,
    });
  }
}
