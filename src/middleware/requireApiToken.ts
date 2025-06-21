import { NextFunction, Request, Response } from 'express';

export function requireApiToken(req: Request, res: Response, next: NextFunction) {
  const AGENT_API_TOKEN = process.env.AGENT_API_TOKEN || '123456';
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = auth.split(' ')[1];
  if (token !== AGENT_API_TOKEN) {
    return res.status(401).json({ error: 'Invalid API token' });
  }
  next();
} 