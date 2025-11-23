import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query, getClient } from '../db';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /users/{id}/wallet
router.get('/:id/wallet',
    authenticateJWT,
    param('id').isUUID(),
    async (req: AuthRequest, res: Response) => {
        const { id } = req.params;

        // Check if user is accessing their own wallet
        if (req.user!.id !== id) {
            // TODO: Check if user is admin
            return res.status(403).json({ error: 'Forbidden', message: 'You can only access your own wallet' });
        }

        try {
            const result = await query(
                'SELECT COALESCE(SUM(amount), 0) as points FROM transactions WHERE user_id = $1',
                [id]
            );

            const points = parseInt(result.rows[0].points);
            const rupeeEquivalent = points; // 1 point = 1 rupee

            res.json({
                user_id: id,
                points,
                rupeeEquivalent,
            });
        } catch (error) {
            console.error('Error fetching wallet:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// POST /users/{id}/redeem
router.post('/:id/redeem',
    authenticateJWT,
    [
        param('id').isUUID(),
        body('amount').isInt({ min: 1 }),
        body('method').isString().notEmpty(),
        body('account').isString().notEmpty(),
    ],
    async (req: AuthRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { amount, method, account } = req.body;

        // Check if user is accessing their own account
        if (req.user!.id !== id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const client = await getClient();

        try {
            await client.query('BEGIN');

            // Check wallet balance
            const balanceRes = await client.query(
                'SELECT COALESCE(SUM(amount), 0) as balance FROM transactions WHERE user_id = $1',
                [id]
            );
            const currentBalance = parseInt(balanceRes.rows[0].balance);

            if (currentBalance < amount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Insufficient balance' });
            }

            // Create payout request
            const payoutRes = await client.query(
                'INSERT INTO payouts (user_id, amount, status) VALUES ($1, $2, $3) RETURNING *',
                [id, amount, 'pending']
            );

            // Deduct from wallet (negative transaction)
            await client.query(
                `INSERT INTO transactions (user_id, amount, type, reference_id)
         VALUES ($1, $2, $3, $4)`,
                [id, -amount, 'payout', payoutRes.rows[0].id]
            );

            await client.query('COMMIT');

            res.status(202).json({
                payout_id: payoutRes.rows[0].id,
                status: payoutRes.rows[0].status,
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error creating payout:', error);
            res.status(500).json({ error: 'Internal server error' });
        } finally {
            client.release();
        }
    }
);

export default router;
