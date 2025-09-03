import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    // Nest HTTP exceptions
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      // If thrown with an object (our preferred pattern), forward it and add path/timestamp
      if (typeof response === 'object' && response !== null) {
        const body = response as Record<string, any>;
        return res.status(status).json({
          path: req.originalUrl,
          timestamp: new Date().toISOString(),
          ...body, // expects { statusCode, message, error, errorCode?, details? }
        });
      }

      // If thrown with a string, normalize it
      return res.status(status).json({
        statusCode: status,
        message: typeof response === 'string' ? response : 'Unexpected error',
        error: HttpStatus[status] ?? 'Error',
        path: req.originalUrl,
        timestamp: new Date().toISOString(),
      });
    }

    // Non-HTTP exceptions (unhandled errors)
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
