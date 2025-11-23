import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { getClient } from '../db';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/',
    authenticateJWT,
    [
        body('token').isString().notEmpty(),
        body('device_id').optional().isString(),
        body('gps').optional().isObject(),
        body('client_time').optional().isISO8601(),
    ],
    async (req: AuthRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { token, device_id, gps, client_time } = req.body;
        const user_id = req.user!.id; // Derived from JWT
        const client = await getClient();

        try {
            await client.query('BEGIN');

            // 1. Lock the coupon row to prevent race conditions
            const couponRes = await client.query(
                'SELECT * FROM coupons WHERE token = $1 FOR UPDATE',
                [token]
            );

            if (couponRes.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Token not found' });
            }

            const coupon = couponRes.rows[0];

            // 2. Check status
            if (coupon.status !== 'issued') {
                await client.query('ROLLBACK');
                return res.status(409).json({ success: false, error: 'Token already redeemed' });
            }

            // 3. Mark as redeemed
            await client.query(
                'UPDATE coupons SET status = $1, redeemed_at = NOW() WHERE token = $2',
                ['redeemed', token]
            );

            // 4. Record scan attempt
            const scanRes = await client.query(
                `INSERT INTO scans (token, user_id, device_id, gps, success)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [token, user_id, device_id, gps, true]
            );

            // 5. Credit points (Transaction)
            await client.query(
                `INSERT INTO transactions (user_id, amount, type, reference_id)
         VALUES ($1, $2, $3, $4)`,
                [user_id, coupon.points, 'redemption', scanRes.rows[0].id]
            );

            // 6. Calculate new wallet balance
            const balanceRes = await client.query(
                'SELECT COALESCE(SUM(amount), 0) as balance FROM transactions WHERE user_id = $1',
                [user_id]
            );
            const newWalletPoints = parseInt(balanceRes.rows[0].balance);

            await client.query('COMMIT');

            res.json({
                success: true,
                pointsCredited: coupon.points,
                newWalletPoints
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Scan error:', error);
            res.status(500).json({ error: 'Internal server error' });
        } finally {
            client.release();
        }
    }
);

export default router;
