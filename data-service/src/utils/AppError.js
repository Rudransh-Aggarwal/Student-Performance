export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const details = err.details || null;

  res.status(statusCode).json({
    error: message,
    ...(details && { details }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}