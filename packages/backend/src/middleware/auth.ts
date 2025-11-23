import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        phone: string;
        role: string;
    };
}

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, config.jwtSecret) as { sub: string; phone: string; role?: string };
        (req as AuthRequest).user = {
            id: decoded.sub,
            phone: decoded.phone,
            role: decoded.role || 'user',
        };
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
    }
};

export const authenticateAdmin = (req: Request, res: Response, next: NextFunction) => {
    const adminKey = req.headers['x-admin-key'];

    if (!adminKey || adminKey !== config.adminApiKey) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid admin key' });
    }

    // Mask key for logging (store first 8 chars + ...)
    (req as any).adminKey = typeof adminKey === 'string' ? adminKey.substring(0, 8) + '...' : 'masked';
    next();
};

// Rate limiting for admin endpoints (in-memory store)
const adminRateLimitStore = new Map<string, number[]>();

export const rateLimitAdmin = (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    const maxRequests = 20; // max 20 requests per minute

    // Get existing requests for this IP
    const requests = (adminRateLimitStore.get(key) || []).filter((timestamp) => now - timestamp < windowMs);

    if (requests.length >= maxRequests) {
        return res.status(429).json({ error: 'Too many requests', message: 'Rate limit exceeded. Try again in a minute.' });
    }

    // Add current request
    requests.push(now);
    adminRateLimitStore.set(key, requests);

    next();
};
