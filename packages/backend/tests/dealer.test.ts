import request from 'supertest';
import app from '../src/index';
import { query, default as pool } from '../src/db';
import { config } from '../src/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('Dealer API', () => {
    let dealerToken: string;
    let dealerId: string;
    let adminKey = config.adminApiKey;
    let batchId: string;
    const dealerPhone = '+15559998888';

    beforeAll(async () => {
        // Clean up
        await query('DELETE FROM dealer_transactions');
        await query('DELETE FROM payouts');
        await query('DELETE FROM flagged_events');
        await query('DELETE FROM scans');
        await query('DELETE FROM transactions');
        await query('DELETE FROM coupons');
        await query('DELETE FROM batches');
        await query('DELETE FROM dealers');
        await query('DELETE FROM users');
        await query('DELETE FROM otps');

        // Create a batch
        const batchRes = await query(
            `INSERT INTO batches (name, sku, points_per_coupon, quantity)
             VALUES ('Test Batch', 'SKU123', 100, 100) RETURNING id`
        );
        batchId = batchRes.rows[0].id;
    });

    afterAll(async () => {
        await pool.end();
    });

    describe('Dealer Registration & Auth', () => {
        it('should register a new dealer', async () => {
            const res = await request(app)
                .post('/dealer/register')
                .send({
                    name: 'Test Dealer',
                    phone: dealerPhone,
                    gst: 'GST999'
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Test Dealer');
            dealerId = res.body.id;
        });

        it('should login as dealer and return role=dealer', async () => {
            // Insert OTP
            const otp = '123456';
            const hash = await bcrypt.hash(otp, 10);
            await query(
                `INSERT INTO otps (phone, otp_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
                [dealerPhone, hash]
            );

            const res = await request(app)
                .post('/auth/verify')
                .send({
                    phone: dealerPhone,
                    otp: otp
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body.user.role).toBe('dealer');
            dealerToken = res.body.token;
        });
    });

    describe('Proxy Scanning', () => {
        let couponToken1 = 'TOKEN1';
        let couponToken2 = 'TOKEN2';
        let couponToken3 = 'TOKEN3';

        beforeAll(async () => {
            await query(
                `INSERT INTO coupons (token, batch_id, points, status) VALUES 
                 ($1, $2, 100, 'issued'),
                 ($3, $2, 100, 'issued'),
                 ($4, $2, 100, 'issued')`,
                [couponToken1, batchId, couponToken2, couponToken3]
            );
        });

        it('should scan for mason and credit mason', async () => {
            const masonPhone = '+15551112222';
            const res = await request(app)
                .post('/dealer/scan-proxy')
                .set('Authorization', `Bearer ${dealerToken}`)
                .send({
                    token: couponToken1,
                    mason_phone: masonPhone,
                    cash_paid: true
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify mason created and credited
            const userRes = await query('SELECT * FROM users WHERE phone = $1', [masonPhone]);
            expect(userRes.rows.length).toBe(1);
            const masonId = userRes.rows[0].id;

            const txRes = await query('SELECT * FROM transactions WHERE user_id = $1', [masonId]);
            expect(txRes.rows.length).toBe(1);
            expect(txRes.rows[0].amount).toBe(100);
            expect(txRes.rows[0].dealer_id).toBe(dealerId);

            // Verify dealer debit (cash paid)
            const dealerTxRes = await query('SELECT * FROM dealer_transactions WHERE dealer_id = $1 AND type = $2', [dealerId, 'debit']);
            expect(dealerTxRes.rows.length).toBe(1);
            expect(dealerTxRes.rows[0].amount).toBe(100);
        });

        it('should scan for dealer credit directly', async () => {
            const res = await request(app)
                .post('/dealer/scan-proxy')
                .set('Authorization', `Bearer ${dealerToken}`)
                .send({
                    token: couponToken2,
                    credit_to_dealer: true
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify dealer credit
            const dealerTxRes = await query('SELECT * FROM dealer_transactions WHERE dealer_id = $1 AND type = $2', [dealerId, 'credit']);
            expect(dealerTxRes.rows.length).toBe(1);
            expect(dealerTxRes.rows[0].amount).toBe(100);
        });

        it('should handle concurrency and prevent double scan', async () => {
            // Create 6 concurrent requests for same token
            const requests = Array(6).fill(null).map(() =>
                request(app)
                    .post('/dealer/scan-proxy')
                    .set('Authorization', `Bearer ${dealerToken}`)
                    .send({
                        token: couponToken3,
                        credit_to_dealer: true
                    })
            );

            const results = await Promise.all(requests);

            const successes = results.filter(r => r.status === 200);
            const conflicts = results.filter(r => r.status === 409);

            expect(successes.length).toBe(1);
            expect(conflicts.length).toBe(5);
        });
    });

    describe('Wallet & Reimbursement', () => {
        it('should return correct wallet balance', async () => {
            // Current state:
            // 1. Debit 100 (cash paid to mason)
            // 2. Credit 100 (direct scan)
            // 3. Credit 100 (concurrency test success)
            // Balance = 100 + 100 - 100 = 100

            const res = await request(app)
                .get(`/dealer/${dealerId}/wallet`)
                .set('Authorization', `Bearer ${dealerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.balance).toBe(100);
        });

        it('should request reimbursement', async () => {
            const res = await request(app)
                .post(`/dealer/${dealerId}/reimburse`)
                .set('Authorization', `Bearer ${dealerToken}`)
                .send({ amount: 50 });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body).toHaveProperty('payoutId');

            // Balance should now be 50 (100 - 50 pending)
            const walletRes = await request(app)
                .get(`/dealer/${dealerId}/wallet`)
                .set('Authorization', `Bearer ${dealerToken}`);
            expect(walletRes.body.balance).toBe(50);
        });
    });

    describe('Admin Dealer Payouts', () => {
        it('should list dealer payouts', async () => {
            const res = await request(app)
                .get('/admin/dealer-payouts')
                .set('x-admin-key', adminKey);

            expect(res.status).toBe(200);
            expect(res.body.payouts.length).toBeGreaterThan(0);
            expect(res.body.payouts[0].status).toBe('pending');
        });

        it('should approve dealer payout', async () => {
            // Get payout ID
            const listRes = await request(app)
                .get('/admin/dealer-payouts')
                .set('x-admin-key', adminKey);
            const payoutId = listRes.body.payouts[0].id;

            const res = await request(app)
                .post(`/admin/dealer-payouts/${payoutId}/approve`)
                .set('x-admin-key', adminKey)
                .send({ reference: 'TXN123' });

            expect(res.status).toBe(200);
            expect(res.body.payout.status).toBe('approved');
            expect(res.body.payout.reference).toBe('TXN123');
        });

        it('should export dealer payouts as CSV', async () => {
            const res = await request(app)
                .get('/admin/dealer-payouts/export')
                .set('x-admin-key', adminKey);

            expect(res.status).toBe(200);
            expect(res.header['content-type']).toContain('text/csv');
            expect(res.text).toContain('TXN123'); // Should contain the reference we just set
        });
    });
});
