import { NextFunction, Request, Response } from 'express';

export function globalErrorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  console.error('Global error handler:', error);
  const errorMessage = NODE_ENV === 'production' ? 'Internal server error' : error.message;
  res.status(500).json({
    error: errorMessage,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
} 