export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, message, 'BAD_REQUEST', details);

export const unauthorized = (message = 'Unauthorized') =>
  new AppError(401, message, 'UNAUTHORIZED');

export const notFound = (message = 'Not found') =>
  new AppError(404, message, 'NOT_FOUND');

export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, message, 'UNPROCESSABLE', details);
