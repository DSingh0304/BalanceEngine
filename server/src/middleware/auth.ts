import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.get("Authorization");
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                error: 'Unauthorized: Missing or invalid token format'
            });
            return;
        }

        const [scheme, token] = authHeader.split(' ');
        if (scheme !== 'Bearer') {
            res.status(401).json({
                error: 'Invalid authorization scheme'
            });
            return;
        }
        if (!token) {
            res.status(401).json({
                error: 'Invalid token'
            });
            return;
        }

        const decoded = jwt.verify(token, env.jwt.secret) as { userId: string, email: string };

        req.user = {
            id: decoded.userId,
            email: decoded.email
        } as any;

        next();
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            res.status(401).json({
                error: 'Unauthorized: Token has expired'
            });
        } else {
            res.status(401).json({
                error: 'Unauthorized: Invalid token'
            });
        }
    }
};