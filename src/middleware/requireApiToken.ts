import { NextFunction, Request, Response } from 'express';

export function requireApiToken(req: Request, res: Response, next: NextFunction) {
  // Authentication disabled - allow all requests
  console.log(`🔓 Authentication disabled: Allowing request for ${req.method} ${req.originalUrl}`);
  return next();
} 