import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { getClient, query } from '../db';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

// Middleware to ensure user is a dealer
const requireDealer = (req: AuthRequest, res: Response, next: Function) => {
    if (req.user?.role !== 'dealer') {
        return res.status(403).json({ error: 'Forbidden', message: 'Access denied. Dealers only.' });
    }
    next();
};

// POST /dealer/register
router.post('/register',
    [
        body('name').isString().notEmpty(),
        body('phone').matches(/^\+?[1-9]\d{1,14}$/),
        body('gst').optional().isString(),
    ],
    async (req: AuthRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, phone, gst } = req.body;

        try {
            const result = await query(
                'INSERT INTO dealers (name, phone, gst) VALUES ($1, $2, $3) RETURNING *',
                [name, phone, gst]
            );
            res.status(201).json(result.rows[0]);
        } catch (error: any) {
            if (error.code === '23505') { // Unique violation
                return res.status(409).json({ error: 'Phone number already registered' });
            }
            console.error('Dealer register error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// POST /dealer/scan-proxy
router.post('/scan-proxy',
    authenticateJWT,
    requireDealer,
    [
        body('token').isString().notEmpty(),
        body('mason_phone').optional().matches(/^\+?[1-9]\d{1,14}$/),
        body('cash_paid').optional().isBoolean(),
        body('credit_to_dealer').optional().isBoolean(),
    ],
    async (req: AuthRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { token, mason_phone, cash_paid, credit_to_dealer } = req.body;
        const dealer_id = req.user!.id;
        const client = await getClient();

        try {
            await client.query('BEGIN');

            // 1. Lock coupon
            const couponRes = await client.query(
                'SELECT * FROM coupons WHERE token = $1 FOR UPDATE',
                [token]
            );

            if (couponRes.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Token not found' });
            }

            const coupon = couponRes.rows[0];

            if (coupon.status !== 'issued') {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'Token already redeemed' });
            }

            // 2. Mark redeemed
            await client.query(
                'UPDATE coupons SET status = $1, redeemed_at = NOW() WHERE token = $2',
                ['redeemed', token]
            );

            let user_id = null;

            // 3. Handle Mason logic
            if (mason_phone) {
                // Find or create mason
                let userRes = await client.query('SELECT id FROM users WHERE phone = $1', [mason_phone]);
                if (userRes.rowCount === 0) {
                    userRes = await client.query(
                        'INSERT INTO users (phone) VALUES ($1) RETURNING id',
                        [mason_phone]
                    );
                }
                user_id = userRes.rows[0].id;

                // Credit Mason
                await client.query(
                    `INSERT INTO transactions (user_id, amount, type, dealer_id)
                     VALUES ($1, $2, 'redemption', $3)`,
                    [user_id, coupon.points, dealer_id]
                );

                // If dealer paid cash, record debit for dealer (optional tracking)
                if (cash_paid) {
                    await client.query(
                        `INSERT INTO dealer_transactions (dealer_id, type, amount, note)
                         VALUES ($1, 'debit', $2, $3)`,
                        [dealer_id, coupon.points, `Cash paid to mason ${mason_phone} for token ${token}`]
                    );
                }
            } else if (credit_to_dealer) {
                // Credit Dealer directly (as a credit transaction in dealer_transactions)
                await client.query(
                    `INSERT INTO dealer_transactions (dealer_id, type, amount, note)
                     VALUES ($1, 'credit', $2, $3)`,
                    [dealer_id, coupon.points, `Direct redemption for token ${token}`]
                );
            }

            // 4. Record Scan
            await client.query(
                `INSERT INTO scans (token, user_id, dealer_id, success)
                 VALUES ($1, $2, $3, true)`,
                [token, user_id, dealer_id]
            );

            await client.query('COMMIT');

            res.json({ success: true, points: coupon.points });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Proxy scan error:', error);
            res.status(500).json({ error: 'Internal server error' });
        } finally {
            client.release();
        }
    }
);

// GET /dealer/:id/wallet
router.get('/:id/wallet',
    authenticateJWT,
    requireDealer,
    async (req: AuthRequest, res: Response) => {
        const { id } = req.params;

        // Ensure dealer can only view their own wallet
        if (req.user!.id !== id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        try {
            // Calculate balance from dealer_transactions
            // Credits (earnings) - Debits (payouts/cash paid)
            // Wait, logic:
            // credit: dealer earned points/money
            // debit: dealer paid cash or withdrew money?
            // reimbursement_request: pending withdrawal?
            // payout: completed withdrawal?

            // Let's assume:
            // credit: +amount
            // debit: -amount
            // payout: -amount (money left system)

            const balanceRes = await query(
                `SELECT 
                    SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) - 
                    SUM(CASE WHEN type IN ('debit', 'payout', 'reimbursement_request') THEN amount ELSE 0 END) as balance
                 FROM dealer_transactions WHERE dealer_id = $1`,
                [id]
            );

            const balance = parseInt(balanceRes.rows[0].balance || '0');

            const transactionsRes = await query(
                'SELECT * FROM dealer_transactions WHERE dealer_id = $1 ORDER BY created_at DESC LIMIT 50',
                [id]
            );

            res.json({ balance, transactions: transactionsRes.rows });
        } catch (error) {
            console.error('Dealer wallet error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// POST /dealer/:id/reimburse
router.post('/:id/reimburse',
    authenticateJWT,
    requireDealer,
    [
        body('amount').isInt({ min: 1 }),
    ],
    async (req: AuthRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { amount } = req.body;

        if (req.user!.id !== id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const client = await getClient();

        try {
            await client.query('BEGIN');

            // Check balance
            const balanceRes = await client.query(
                `SELECT 
                    SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) - 
                    SUM(CASE WHEN type IN ('debit', 'payout', 'reimbursement_request') THEN amount ELSE 0 END) as balance
                 FROM dealer_transactions WHERE dealer_id = $1`,
                [id]
            );
            const balance = parseInt(balanceRes.rows[0].balance || '0');

            if (balance < amount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Insufficient balance' });
            }

            // Create Payout Request
            const payoutRes = await client.query(
                `INSERT INTO payouts (dealer_id, amount, status, type, reference)
                 VALUES ($1, $2, 'pending', 'dealer', 'Reimbursement Request') RETURNING id`,
                [id, amount]
            );

            // Record transaction (reimbursement_request - maybe doesn't affect balance yet? or blocks funds?)
            // Usually we block funds. Let's treat 'reimbursement_request' as a debit or hold.
            // For simplicity, let's just log it. The actual debit happens on 'payout' (approval).
            // OR we can debit now and refund if rejected.
            // Let's debit now to prevent double spend.
            // Wait, my balance calc subtracts 'payout' but not 'reimbursement_request'.
            // Let's subtract 'reimbursement_request' too.

            await client.query(
                `INSERT INTO dealer_transactions (dealer_id, type, amount, note)
                 VALUES ($1, 'reimbursement_request', $2, $3)`,
                [id, amount, `Payout request ${payoutRes.rows[0].id}`]
            );

            await client.query('COMMIT');
            res.json({ success: true, payoutId: payoutRes.rows[0].id });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Reimburse error:', error);
            res.status(500).json({ error: 'Internal server error' });
        } finally {
            client.release();
        }
    }
);

export default router;
