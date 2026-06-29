import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * DB 계층 에러를 사용자 친화적인 HTTP 응답으로 변환한다.
 *
 * - 서비스가 던진 HttpException(NotFound/BadRequest 등)은 그대로 통과시킨다.
 * - Prisma 알려진 에러(P2002/P2003/P2025)는 409/409/404로 매핑.
 * - DB 트리거의 RAISE EXCEPTION(정합성 가드)은 Prisma가 UnknownRequestError로 surface →
 *   500 대신 400으로 매핑(내부 메시지는 로그에만, 응답엔 일반 메시지).
 * - 그 외는 기본 처리(500)로 위임.
 */
@Catch()
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 1) 이미 HttpException이면 그대로 전달 (서비스가 의도한 상태/메시지 유지)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(exception.getResponse());
      return;
    }

    // 2) Prisma 알려진 요청 에러 — 코드별 매핑
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.mapKnownPrismaError(exception.code);
      if (mapped) {
        this.logger.warn(`Prisma ${exception.code} → ${mapped.status}: ${exception.message.split('\n').pop()}`);
        response.status(mapped.status).json({ statusCode: mapped.status, message: mapped.message });
        return;
      }
    }

    // 3) DB 트리거 RAISE EXCEPTION 등 — Prisma가 분류 못한 DB 제약 위반은 400으로
    if (this.isDatabaseConstraintError(exception)) {
      const original = (exception as { message?: string })?.message ?? '알 수 없는 DB 오류';
      this.logger.warn(`DB constraint violation → 400: ${original}`);
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: '요청을 처리할 수 없습니다. 데이터 제약 조건을 확인해주세요.',
      });
      return;
    }

    // 4) 그 외 — 기본 500
    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }

  private mapKnownPrismaError(code: string): { status: number; message: string } | null {
    switch (code) {
      case 'P2002': // unique 제약 위반
        return { status: HttpStatus.CONFLICT, message: '이미 존재하는 값입니다.' };
      case 'P2003': // FK 제약(onDelete: Restrict 등) 위반
        return { status: HttpStatus.CONFLICT, message: '연관된 데이터가 있어 처리할 수 없습니다.' };
      case 'P2025': // 대상 레코드 없음
        return { status: HttpStatus.NOT_FOUND, message: '대상을 찾을 수 없습니다.' };
      default:
        return null;
    }
  }

  private isDatabaseConstraintError(exception: unknown): boolean {
    if (
      exception instanceof Prisma.PrismaClientKnownRequestError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientValidationError
    ) {
      return true;
    }
    // 드라이버 어댑터(@prisma/adapter-pg)가 트리거 RAISE를 DriverAdapterError로 던지는 경우
    const name = (exception as { constructor?: { name?: string } })?.constructor?.name ?? '';
    return name === 'DriverAdapterError' || name.startsWith('PrismaClient');
  }
}
