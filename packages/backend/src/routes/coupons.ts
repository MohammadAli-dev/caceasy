import { Router, Response, Request } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /coupons/generate - Generate coupons (auth required)
router.post('/generate',
    authenticateJWT,
    [
        body('batch_id').isUUID(),
        body('quantity').isInt({ min: 1, max: 10000 }),
        body('points').isInt({ min: 1 }),
    ],
    async (req: AuthRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { batch_id, quantity, points, prefix } = req.body;

        try {
            // Verify batch exists
            const batchRes = await query('SELECT * FROM batches WHERE id = $1', [batch_id]);
            if (batchRes.rowCount === 0) {
                return res.status(404).json({ error: 'Batch not found' });
            }

            // Generate tokens
            const coupons: any[] = [];
            const values: any[] = [];
            const placeholders: string[] = [];

            let paramIndex = 1;
            for (let i = 0; i < quantity; i++) {
                const token = prefix ? `${prefix}-${uuidv4()}` : uuidv4();
                coupons.push({ token, batch_id, points });
                values.push(token, batch_id, points);
                placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
                paramIndex += 3;
            }

            // Bulk insert coupons
            const insertQuery = `
        INSERT INTO coupons (token, batch_id, points)
        VALUES ${placeholders.join(', ')}
      `;

            await query(insertQuery, values);

            // Return CSV if requested, otherwise JSON
            if (req.headers.accept === 'text/csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.status(201).send(coupons.map(c => c.token).join('\n'));
            } else {
                res.status(201).json({
                    success: true,
                    batch_id,
                    count: coupons.length,
                    coupons,
                });
            }
        } catch (error) {
            console.error('Error generating coupons:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// GET /coupons/{token} - Get coupon details
router.get('/:token',
    param('token').isString(),
    async (req: Request, res: Response) => {
        const { token } = req.params;

        try {
            const result = await query('SELECT * FROM coupons WHERE token = $1', [token]);
            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'Coupon not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error fetching coupon:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

export default router;
