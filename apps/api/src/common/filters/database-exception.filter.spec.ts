import { ArgumentsHost, BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseExceptionFilter } from './database-exception.filter';

describe('DatabaseExceptionFilter', () => {
  let filter: DatabaseExceptionFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new DatabaseExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;
  });

  it('HttpException은 상태/응답을 그대로 통과시킨다', () => {
    filter.catch(new NotFoundException('고객을 찾을 수 없습니다.'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('BadRequestException도 그대로 통과', () => {
    filter.catch(new BadRequestException('잘못된 요청'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('Prisma P2002(unique) → 409', () => {
    const err = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '7' });
    filter.catch(err, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });

  it('Prisma P2003(FK Restrict) → 409', () => {
    const err = new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: '7' });
    filter.catch(err, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });

  it('Prisma P2025(not found) → 404', () => {
    const err = new Prisma.PrismaClientKnownRequestError('missing', { code: 'P2025', clientVersion: '7' });
    filter.catch(err, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('DB 트리거 RAISE EXCEPTION(UnknownRequestError) → 400', () => {
    const err = new Prisma.PrismaClientUnknownRequestError(
      'Invalid ServiceRequest status transition: SCHEDULED -> RECEIVED',
      { clientVersion: '7' },
    );
    filter.catch(err, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: HttpStatus.BAD_REQUEST }));
  });

  it('알 수 없는 일반 에러 → 500', () => {
    filter.catch(new Error('boom'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
