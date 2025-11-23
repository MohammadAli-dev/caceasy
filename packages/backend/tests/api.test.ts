import request from 'supertest';
import app from '../src/index';
import pool from '../src/db';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

describe('Module 1 - OpenAPI + Auth + Wallet Tests', () => {
    let testPhone: string;
    let testOtp: string;
    let testToken: string;
    let userId: string;
    let batchId: string;
    let couponToken: string;

    beforeAll(async () => {
        // Run migrations to set up the database schema
        const seedSqlPath = path.resolve(__dirname, '../../../infra/seed/seed.sql');

        if (!fs.existsSync(seedSqlPath)) {
            throw new Error(`Seed SQL file not found at ${seedSqlPath}`);
        }

        const sql = fs.readFileSync(seedSqlPath, 'utf8');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Drop tables to ensure fresh schema
            await client.query(`
                DROP TABLE IF EXISTS transactions CASCADE;
                DROP TABLE IF EXISTS scans CASCADE;
                DROP TABLE IF EXISTS coupons CASCADE;
                DROP TABLE IF EXISTS batches CASCADE;
                DROP TABLE IF EXISTS otps CASCADE;
                DROP TABLE IF EXISTS payouts CASCADE;
                DROP TABLE IF EXISTS users CASCADE;
            `);
            await client.query(sql);
            await client.query('COMMIT');
            console.log('Database schema initialized successfully');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Failed to initialize database schema:', error);
            throw error;
        } finally {
            client.release();
        }

        testPhone = `+1555${Date.now().toString().slice(-7)}`;
    });

    afterAll(async () => {
        await pool.end();
    });

    describe('OpenAPI Specification', () => {
        it('should parse openapi.yaml successfully', () => {
            let openapiPath = path.resolve(__dirname, '../../../openapi.yaml');
            if (!fs.existsSync(openapiPath)) {
                openapiPath = path.resolve(__dirname, '../openapi.yaml');
            }
            expect(fs.existsSync(openapiPath)).toBe(true);

            const openapiContent = fs.readFileSync(openapiPath, 'utf8');
            const openapiDoc = yaml.load(openapiContent) as any;

            expect(openapiDoc.openapi).toBe('3.0.3');
            expect(openapiDoc.info.title).toBe('caceasy API');
            expect(openapiDoc.paths['/auth/otp']).toBeDefined();
            expect(openapiDoc.paths['/auth/verify']).toBeDefined();
            expect(openapiDoc.paths['/scan']).toBeDefined();
            expect(openapiDoc.components.securitySchemes.bearerAuth).toBeDefined();
        });
    });

    describe('GET /health', () => {
        it('should return 200 OK', async () => {
            const res = await request(app).get('/health');
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ status: 'ok' });
        });
    });

    describe('GET /version', () => {
        it('should return version info', async () => {
            const res = await request(app).get('/version');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('version');
            expect(res.body).toHaveProperty('env');
        });
    });

    describe('Auth Flow', () => {
        it('should request OTP', async () => {
            const res = await request(app)
                .post('/auth/otp')
                .send({ phone: testPhone });

            expect(res.status).toBe(202);
            expect(res.body.message).toBe('OTP sent');

            // Extract OTP from console (in real scenario, this would be from SMS)
            // For testing, we'll query the database
            const otpRes = await pool.query(
                'SELECT * FROM otps WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
                [testPhone]
            );
            expect(otpRes.rowCount).toBeGreaterThan(0);
        });

        it('should verify OTP and return JWT', async () => {
            // Get the OTP hash from database for testing
            const otpRes = await pool.query(
                'SELECT * FROM otps WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
                [testPhone]
            );

            // For testing, we need to know the OTP. In production, user would receive it via SMS.
            // Let's create a new OTP with a known value
            const knownOtp = '123456';
            const bcrypt = require('bcryptjs');
            const otpHash = await bcrypt.hash(knownOtp, 10);
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

            await pool.query(
                'INSERT INTO otps (phone, otp_hash, expires_at) VALUES ($1, $2, $3)',
                [testPhone, otpHash, expiresAt]
            );

            const res = await request(app)
                .post('/auth/verify')
                .send({ phone: testPhone, otp: knownOtp });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('user');
            expect(res.body.user.phone).toBe(testPhone);

            testToken = res.body.token;
            userId = res.body.user.id;
        });

        it('should reject invalid OTP', async () => {
            const res = await request(app)
                .post('/auth/verify')
                .send({ phone: testPhone, otp: '999999' });

            expect(res.status).toBe(401);
        });
    });

    describe('JWT Enforcement', () => {
        it('should reject unauthenticated requests to protected endpoints', async () => {
            const res = await request(app)
                .post('/batches')
                .send({ name: 'Test', sku: 'TEST001' });

            expect(res.status).toBe(401);
        });

        it('should accept authenticated requests', async () => {
            const res = await request(app)
                .post('/batches')
                .set('Authorization', `Bearer ${testToken}`)
                .send({ name: 'Test Batch', sku: 'TEST001' });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            batchId = res.body.id;
        });
    });

    describe('Coupon Generation', () => {
        it('should generate coupons with auth', async () => {
            const res = await request(app)
                .post('/coupons/generate')
                .set('Authorization', `Bearer ${testToken}`)
                .send({ batch_id: batchId, quantity: 5, points: 100 });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(5);
            expect(res.body.coupons).toHaveLength(5);

            couponToken = res.body.coupons[0].token;

            // Verify coupons in DB
            const dbRes = await pool.query(
                'SELECT COUNT(*) FROM coupons WHERE batch_id = $1',
                [batchId]
            );
            expect(parseInt(dbRes.rows[0].count)).toBe(5);
        });

        it('should return CSV when Accept: text/csv', async () => {
            const res = await request(app)
                .post('/coupons/generate')
                .set('Authorization', `Bearer ${testToken}`)
                .set('Accept', 'text/csv')
                .send({ batch_id: batchId, quantity: 3, points: 50 });

            expect(res.status).toBe(201);
            expect(res.headers['content-type']).toContain('text/csv');
            expect(res.text.split('\n')).toHaveLength(3);
        });
    });

    describe('GET /coupons/{token}', () => {
        it('should get coupon details', async () => {
            const res = await request(app).get(`/coupons/${couponToken}`);

            expect(res.status).toBe(200);
            expect(res.body.token).toBe(couponToken);
            expect(res.body.status).toBe('issued');
        });

        it('should return 404 for non-existent token', async () => {
            const res = await request(app).get('/coupons/nonexistent');
            expect(res.status).toBe(404);
        });
    });

    describe('Scan - Concurrency Test', () => {
        let concurrentToken: string;

        beforeAll(async () => {
            // Ensure we have a batch
            if (!batchId) {
                const batchRes = await request(app)
                    .post('/batches')
                    .set('Authorization', `Bearer ${testToken}`)
                    .send({ name: 'Concurrency Batch', sku: 'CONC001' });
                batchId = batchRes.body.id;
            }

            // Generate a fresh coupon for concurrency test
            const genRes = await request(app)
                .post('/coupons/generate')
                .set('Authorization', `Bearer ${testToken}`)
                .send({ batch_id: batchId, quantity: 1, points: 500 });

            if (!genRes.body.coupons || !genRes.body.coupons[0]) {
                console.error('Coupon generation failed:', genRes.body);
                throw new Error('Failed to generate coupon for concurrency test');
            }
            concurrentToken = genRes.body.coupons[0].token;
        });

        it('should handle concurrent scans atomically (1 success, 9 conflicts)', async () => {
            // Fire 10 concurrent requests
            const requests = Array(10).fill(null).map(() =>
                request(app)
                    .post('/scan')
                    .set('Authorization', `Bearer ${testToken}`)
                    .send({ token: concurrentToken, device_id: 'test-device' })
            );

            const results = await Promise.all(requests);

            const successes = results.filter(r => r.status === 200);
            const conflicts = results.filter(r => r.status === 409);

            console.log(`Concurrency Test: ${successes.length} successes, ${conflicts.length} conflicts`);

            expect(successes.length).toBe(1);
            expect(conflicts.length).toBe(9);

            // Verify database state
            const couponRes = await pool.query(
                'SELECT status FROM coupons WHERE token = $1',
                [concurrentToken]
            );
            expect(couponRes.rows[0].status).toBe('redeemed');

            const scanRes = await pool.query(
                'SELECT COUNT(*) FROM scans WHERE token = $1',
                [concurrentToken]
            );
            expect(parseInt(scanRes.rows[0].count)).toBe(1);

            const txRes = await pool.query(
                'SELECT COUNT(*) FROM transactions WHERE user_id = $1 AND type = $2',
                [userId, 'redemption']
            );
            // Should have at least 1 transaction from concurrency test
            expect(parseInt(txRes.rows[0].count)).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Wallet', () => {
        it('should successfully redeem a new token and update wallet', async () => {
            // Ensure we have a batch
            if (!batchId) {
                const batchRes = await request(app)
                    .post('/batches')
                    .set('Authorization', `Bearer ${testToken}`)
                    .send({ name: 'Wallet Batch', sku: 'WALL001' });
                batchId = batchRes.body.id;
            }

            // Generate fresh coupon
            const genRes = await request(app)
                .post('/coupons/generate')
                .set('Authorization', `Bearer ${testToken}`)
                .send({ batch_id: batchId, quantity: 1, points: 200 });

            if (!genRes.body.coupons || !genRes.body.coupons[0]) {
                console.error('Coupon generation failed in Wallet test:', genRes.body);
                throw new Error('Failed to generate coupon for wallet test');
            }
            const newToken = genRes.body.coupons[0].token;

            // Scan it
            const scanRes = await request(app)
                .post('/scan')
                .set('Authorization', `Bearer ${testToken}`)
                .send({ token: newToken, device_id: 'test-device' });

            expect(scanRes.status).toBe(200);
            expect(scanRes.body.success).toBe(true);
            expect(scanRes.body.pointsCredited).toBe(200);
        });

        it('should get wallet balance', async () => {
            const res = await request(app)
                .get(`/users/${userId}/wallet`)
                .set('Authorization', `Bearer ${testToken}`);

            expect(res.status).toBe(200);
            expect(res.body.user_id).toBe(userId);
            expect(res.body.points).toBeGreaterThanOrEqual(200);
            expect(res.body.rupeeEquivalent).toBe(res.body.points);
        });

        it('should reject access to another user\'s wallet', async () => {
            const res = await request(app)
                .get('/users/00000000-0000-0000-0000-000000000000/wallet')
                .set('Authorization', `Bearer ${testToken}`);

            expect(res.status).toBe(403);
        });

        it('should create payout request', async () => {
            const res = await request(app)
                .post(`/users/${userId}/redeem`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ amount: 100, method: 'bank', account: '1234567890' });

            expect(res.status).toBe(202);
            expect(res.body).toHaveProperty('payout_id');
            expect(res.body.status).toBe('pending');
        });
    });

    describe('Admin Endpoints', () => {
        it('should reject requests without admin key', async () => {
            const res = await request(app).get('/admin/payouts');
            expect(res.status).toBe(401);
        });

        it('should return payouts with valid admin key', async () => {
            const res = await request(app)
                .get('/admin/payouts')
                .set('x-admin-key', 'dev_admin_key');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('payouts');
            expect(Array.isArray(res.body.payouts)).toBe(true);
        });

        it('should return flagged activities', async () => {
            const res = await request(app)
                .get('/admin/flagged')
                .set('x-admin-key', 'dev_admin_key');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('flagged');
        });
    });
});
