import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();
    const errorResponse = exception.getResponse();

    const res =
      typeof errorResponse === 'string'
        ? { message: errorResponse }
        : errorResponse;

    response.status(status).json({
      statusCode: status,
      ...res,
      timestamp: new Date().toISOString(),
    });
  }
}
