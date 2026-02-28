import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import db from './database';

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthenticatedRequest extends Request {
  user?: { id: number; role: string };
}

export const verifyToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Check for token in authorization header first, then in cookies
  const authHeaderToken = req.headers.authorization?.split(' ')[1];
  const cookieToken = req.cookies?.['auth-token'];
  const token = authHeaderToken || cookieToken;

  if (!token) {
    return res.status(403).json({ error: 'Se requiere un token para la autenticación' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded as { id: number; role: string };
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  return next();
};

export const isAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Se requiere rol de administrador' });
  }
  next();
};
