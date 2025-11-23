import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
});

router.get('/version', (req: Request, res: Response) => {
    res.json({
        version: '0.1.0',
        env: config.nodeEnv
    });
});

export default router;
