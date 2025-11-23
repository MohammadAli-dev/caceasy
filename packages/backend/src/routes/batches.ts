import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /batches - Create a new batch (auth required)
router.post('/',
    authenticateJWT,
    [
        body('name').isString().notEmpty(),
        body('sku').isString().notEmpty(),
    ],
    async (req: AuthRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, sku } = req.body;

        try {
            const result = await query(
                'INSERT INTO batches (name, sku, points_per_coupon, quantity) VALUES ($1, $2, $3, $4) RETURNING *',
                [name, sku, 0, 0] // Placeholder values
            );

            const batch = result.rows[0];
            res.status(201).json({
                id: batch.id,
                name: batch.name,
                sku: batch.sku,
                created_at: batch.created_at,
            });
        } catch (error) {
            console.error('Error creating batch:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

export default router;
