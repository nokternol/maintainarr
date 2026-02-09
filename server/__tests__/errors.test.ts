import { describe, expect, it } from 'vitest';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../errors';

describe('AppError', () => {
  it('has correct defaults', () => {
    const err = new AppError('something broke');
    expect(err.message).toBe('something broke');
    expect(err.statusCode).toBe(500);
    expect(err.type).toBe('INTERNAL_ERROR');
    expect(err.isOperational).toBe(true);
    expect(err.name).toBe('AppError');
  });

  it('accepts custom status, type, and isOperational', () => {
    const err = new AppError('bad', 503, 'SERVICE_UNAVAILABLE', false);
    expect(err.statusCode).toBe(503);
    expect(err.type).toBe('SERVICE_UNAVAILABLE');
    expect(err.isOperational).toBe(false);
  });

  it('is an instance of Error', () => {
    const err = new AppError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('captures a stack trace', () => {
    const err = new AppError('test');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('AppError');
  });
});

describe('NotFoundError', () => {
  it('has correct defaults', () => {
    const err = new NotFoundError();
    expect(err.message).toBe('Resource not found');
    expect(err.statusCode).toBe(404);
    expect(err.type).toBe('NOT_FOUND');
    expect(err.isOperational).toBe(true);
  });

  it('accepts a custom message', () => {
    const err = new NotFoundError('User 42 not found');
    expect(err.message).toBe('User 42 not found');
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of AppError', () => {
    expect(new NotFoundError()).toBeInstanceOf(AppError);
  });
});

describe('ValidationError', () => {
  it('has correct defaults', () => {
    const err = new ValidationError();
    expect(err.message).toBe('Validation failed');
    expect(err.statusCode).toBe(400);
    expect(err.type).toBe('VALIDATION_ERROR');
    expect(err.errors).toEqual({});
  });

  it('carries field errors', () => {
    const fieldErrors = { email: ['Invalid email format'] };
    const err = new ValidationError('Bad input', fieldErrors);
    expect(err.errors).toEqual(fieldErrors);
  });

  it('is an instance of AppError', () => {
    expect(new ValidationError()).toBeInstanceOf(AppError);
  });
});

describe('UnauthorizedError', () => {
  it('has correct defaults', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.type).toBe('UNAUTHORIZED');
  });

  it('is an instance of AppError', () => {
    expect(new UnauthorizedError()).toBeInstanceOf(AppError);
  });
});

describe('ForbiddenError', () => {
  it('has correct defaults', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.type).toBe('FORBIDDEN');
  });

  it('is an instance of AppError', () => {
    expect(new ForbiddenError()).toBeInstanceOf(AppError);
  });
});

describe('ConflictError', () => {
  it('has correct defaults', () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
    expect(err.type).toBe('CONFLICT');
  });

  it('is an instance of AppError', () => {
    expect(new ConflictError()).toBeInstanceOf(AppError);
  });
});
