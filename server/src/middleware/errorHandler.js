import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      data: err.issues,
      message: 'Validation failed',
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      data: err.details,
      message: err.message,
    });
  }

  if (err?.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      data: null,
      message: err.message,
    });
  }

  logger.error(err);
  return res.status(500).json({
    success: false,
    data: null,
    message: err.message || 'Internal server error',
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    data: null,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}
