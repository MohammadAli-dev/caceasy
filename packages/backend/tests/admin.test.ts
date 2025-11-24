import request from 'supertest';
import app from '../src/index';
import { query as dbQuery } from '../src/db';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'dev_admin_key';

describe('Admin API', () => {
    describe('Authentication', () => {
        it('returns 401 without x-admin-key header', async () => {
            const res = await request(app).get('/admin/analytics');
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Unauthorized');
        });

        it('returns 401 with invalid x-admin-key', async () => {
            const res = await request(app)
                .get('/admin/analytics')
                .set('x-admin-key', 'invalid-key');
            expect(res.status).toBe(401);
        });

        it('allows request with valid x-admin-key', async () => {
            const res = await request(app)
                .get('/admin/analytics')
                .set('x-admin-key', ADMIN_API_KEY);
            expect(res.status).toBe(200);
        });
    });

    describe('Rate Limiting', () => {
        it.skip('blocks after exceeding rate limit', async () => {
            // Make 21 requests (limit is 20)
            const requests = [];
            for (let i = 0; i < 21; i++) {
                requests.push(
                    request(app)
                        .get('/admin/analytics')
                        .set('x-admin-key', ADMIN_API_KEY)
                );
            }

            const responses = await Promise.all(requests);
            const blockedResponses = responses.filter((r) => r.status === 429);
            expect(blockedResponses.length).toBeGreaterThan(0);
        }, 10000);
    });

    describe('GET /admin/flagged', () => {
        beforeAll(async () => {
            // Seed test data
            const userResult = await dbQuery(`
                INSERT INTO users (phone, name) 
                VALUES ('9999999999', 'Test User') 
                ON CONFLICT (phone) DO UPDATE SET name = 'Test User'
                RETURNING id
            `);
            const userId = userResult.rows[0].id;

            const batchResult = await dbQuery(`
                INSERT INTO batches (name, sku, points_per_coupon, quantity) 
                VALUES ('Test Batch', 'TEST-SKU', 10, 100) 
                RETURNING id
            `);
            const batchId = batchResult.rows[0].id;

            const scanResult = await dbQuery(`
                INSERT INTO scans (user_id, device_id, success) 
                VALUES ($1, 'device-123', true) 
                RETURNING id
            `, [userId]);
            const scanId = scanResult.rows[0].id;

            await dbQuery(`
                INSERT INTO flagged_events (scan_id, user_id, device_id, batch_id, risk_score, reason, status) 
                VALUES ($1, $2, 'device-123', $3, 75, 'High frequency scans', 'open')
            `, [scanId, userId, batchId]);
        });

        it('returns flagged events with default pagination', async () => {
            const res = await request(app)
                .get('/admin/flagged')
                .set('x-admin-key', ADMIN_API_KEY);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('flagged');
            expect(res.body).toHaveProperty('total');
            expect(res.body).toHaveProperty('page');
            expect(res.body).toHaveProperty('limit');
            expect(Array.isArray(res.body.flagged)).toBe(true);
        });

        it('filters by status=open', async () => {
            const res = await request(app)
                .get('/admin/flagged?status=open')
                .set('x-admin-key', ADMIN_API_KEY);

            expect(res.status).toBe(200);
            res.body.flagged.forEach((event: any) => {
                expect(event.status).toBe('open');
            });
        });

        it('supports pagination', async () => {
            const res = await request(app)
                .get('/admin/flagged?page=1&limit=5')
                .set('x-admin-key', ADMIN_API_KEY);

            expect(res.status).toBe(200);
            expect(res.body.page).toBe(1);
            expect(res.body.limit).toBe(5);
        });
    });

    describe('POST /admin/flagged/:id/resolve', () => {
        let flaggedEventId: string;

        beforeAll(async () => {
            const userResult = await dbQuery(`
                INSERT INTO users (phone, name) 
                VALUES ('8888888888', 'Test User 2') 
                ON CONFLICT (phone) DO UPDATE SET name = 'Test User 2'
                RETURNING id
            `);
            const userId = userResult.rows[0].id;

            const scanResult = await dbQuery(`
                INSERT INTO scans (user_id, device_id, success) 
                VALUES ($1, 'device-456', true) 
                RETURNING id
            `, [userId]);
            const scanId = scanResult.rows[0].id;

            const flaggedResult = await dbQuery(`
                INSERT INTO flagged_events (scan_id, user_id, device_id, risk_score, reason, status) 
                VALUES ($1, $2, 'device-456', 80, 'Suspicious pattern', 'open')
                RETURNING id
            `, [scanId, userId]);
            flaggedEventId = flaggedResult.rows[0].id;
        });

        it('resolves a flagged event and creates audit log', async () => {
            const res = await request(app)
                .post(`/admin/flagged/${flaggedEventId}/resolve`)
                .set('x-admin-key', ADMIN_API_KEY)
                .send({
                    action: 'verified_legitimate',
                    notes: 'Verified with user, legitimate activity',
                });

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('resolved');
            expect(res.body.event.status).toBe('resolved');

            // Verify audit log was created
            const auditResult = await dbQuery(`
                SELECT * FROM admin_audit WHERE action = 'flagged_event_resolved' ORDER BY created_at DESC LIMIT 1
            `);
            expect(auditResult.rows.length).toBe(1);
            expect(auditResult.rows[0].payload).toHaveProperty('flagged_event_id');
        });

        it('returns 404 for non-existent flagged event', async () => {
            const res = await request(app)
                .post('/admin/flagged/00000000-0000-0000-0000-000000000000/resolve')
                .set('x-admin-key', ADMIN_API_KEY)
                .send({
                    action: 'verified_legitimate',
                    notes: 'Test',
                });

            expect(res.status).toBe(404);
        });
    });

    describe('GET /admin/payouts', () => {
        beforeAll(async () => {
            const userResult = await dbQuery(`
                INSERT INTO users (phone, name) 
                VALUES ('7777777777', 'Payout Test User') 
                ON CONFLICT (phone) DO UPDATE SET name = 'Payout Test User'
                RETURNING id
            `);
            const userId = userResult.rows[0].id;

            await dbQuery(`
                INSERT INTO payouts (user_id, amount, status) 
                VALUES ($1, 5000, 'pending'), ($1, 3000, 'approved')
            `, [userId]);
        });

        it('returns all payouts', async () => {
            const res = await request(app)
                .get('/admin/payouts')
                .set('x-admin-key', ADMIN_API_KEY);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('payouts');
            expect(Array.isArray(res.body.payouts)).toBe(true);
        });

        it('filters by status=pending', async () => {
            const res = await request(app)
                .get('/admin/payouts?status=pending')
                .set('x-admin-key', ADMIN_API_KEY);

            expect(res.status).toBe(200);
            res.body.payouts.forEach((payout: any) => {
                expect(payout.status).toBe('pending');
            });
        });
    });

    describe('POST /admin/payouts/:id/approve', () => {
        let payoutId: string;

        beforeAll(async () => {
            const userResult = await dbQuery(`
                INSERT INTO users (phone, name) 
                VALUES ('6666666666', 'Approve Test User') 
                ON CONFLICT (phone) DO UPDATE SET name = 'Approve Test User'
                RETURNING id
            `);
            const userId = userResult.rows[0].id;

            const payoutResult = await dbQuery(`
                INSERT INTO payouts (user_id, amount, status) 
                VALUES ($1, 10000, 'pending')
                RETURNING id
            `, [userId]);
            payoutId = payoutResult.rows[0].id;
        });

        it('approves a payout and creates audit log', async () => {
            const res = await request(app)
                .post(`/admin/payouts/${payoutId}/approve`)
                .set('x-admin-key', ADMIN_API_KEY)
                .send({ reference: 'TXN12345' });

            expect(res.status).toBe(200);
            expect(res.body.payout.status).toBe('approved');
            expect(res.body.payout.reference).toBe('TXN12345');

            // Verify audit log
            const auditResult = await dbQuery(`
                SELECT * FROM admin_audit WHERE action = 'payout_approved' ORDER BY created_at DESC LIMIT 1
            `);
            expect(auditResult.rows.length).toBe(1);
        });
    });

    describe('POST /admin/payouts/:id/reject', () => {
        let payoutId: string;

        beforeAll(async () => {
            const userResult = await dbQuery(`
                INSERT INTO users (phone, name) 
                VALUES ('5555555555', 'Reject Test User') 
                ON CONFLICT (phone) DO UPDATE SET name = 'Reject Test User'
                RETURNING id
            `);
            const userId = userResult.rows[0].id;

            const payoutResult = await dbQuery(`
                INSERT INTO payouts (user_id, amount, status) 
                VALUES ($1, 2000, 'pending')
                RETURNING id
            `, [userId]);
            payoutId = payoutResult.rows[0].id;
        });

        it('rejects a payout and creates audit log', async () => {
            const res = await request(app)
                .post(`/admin/payouts/${payoutId}/reject`)
                .set('x-admin-key', ADMIN_API_KEY)
                .send({ notes: 'Insufficient account verification' });

            expect(res.status).toBe(200);
            expect(res.body.payout.status).toBe('rejected');

            // Verify audit log
            const auditResult = await dbQuery(`
                SELECT * FROM admin_audit WHERE action = 'payout_rejected' ORDER BY created_at DESC LIMIT 1
            `);
            expect(auditResult.rows.length).toBe(1);
        });
    });

    describe('GET /admin/analytics', () => {
        it('returns all required KPIs', async () => {
            const res = await request(app)
                .get('/admin/analytics')
                .set('x-admin-key', ADMIN_API_KEY);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('scans_per_day');
            expect(res.body).toHaveProperty('active_masons');
            expect(res.body).toHaveProperty('redemption_rate');
            expect(res.body).toHaveProperty('pending_payouts_count');
            expect(res.body).toHaveProperty('top_regions');

            expect(typeof res.body.scans_per_day).toBe('number');
            expect(typeof res.body.active_masons).toBe('number');
            expect(typeof res.body.redemption_rate).toBe('number');
            expect(typeof res.body.pending_payouts_count).toBe('number');
            expect(Array.isArray(res.body.top_regions)).toBe(true);
        });
    });

    describe('GET /admin/batches', () => {
        it('returns batches with counts', async () => {
            const res = await request(app)
                .get('/admin/batches')
                .set('x-admin-key', ADMIN_API_KEY);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('batches');
            expect(Array.isArray(res.body.batches)).toBe(true);

            if (res.body.batches.length > 0) {
                const batch = res.body.batches[0];
                expect(batch).toHaveProperty('id');
                expect(batch).toHaveProperty('name');
                expect(batch).toHaveProperty('sku');
                expect(batch).toHaveProperty('issued');
                expect(batch).toHaveProperty('redeemed');
                expect(batch).toHaveProperty('pending');
            }
        });
    });

    describe('POST /admin/batch', () => {
        it('creates a new batch and logs audit', async () => {
            const res = await request(app)
                .post('/admin/batch')
                .set('x-admin-key', ADMIN_API_KEY)
                .send({
                    name: 'Test Admin Batch',
                    sku: 'ADMIN-TEST-001',
                    points_per_scan: 15,
                    quantity: 50,
                });

            expect(res.status).toBe(201);
            expect(res.body.batch).toHaveProperty('id');
            expect(res.body.batch.name).toBe('Test Admin Batch');

            // Verify audit log
            const auditResult = await dbQuery(`
                SELECT * FROM admin_audit WHERE action = 'batch_created' ORDER BY created_at DESC LIMIT 1
            `);
            expect(auditResult.rows.length).toBe(1);
        });

        it('returns 400 for missing required fields', async () => {
            const res = await request(app)
                .post('/admin/batch')
                .set('x-admin-key', ADMIN_API_KEY)
                .send({ name: 'Incomplete Batch' });

            expect(res.status).toBe(400);
        });
    });

    describe('GET /admin/audit', () => {
        it('returns recent audit logs', async () => {
            const res = await request(app)
                .get('/admin/audit')
                .set('x-admin-key', ADMIN_API_KEY);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('audit_logs');
            expect(Array.isArray(res.body.audit_logs)).toBe(true);

            if (res.body.audit_logs.length > 0) {
                const log = res.body.audit_logs[0];
                expect(log).toHaveProperty('admin_identifier');
                expect(log).toHaveProperty('action');
                expect(log).toHaveProperty('created_at');
            }
        });

        it('supports limit parameter', async () => {
            const res = await request(app)
                .get('/admin/audit?limit=5')
                .set('x-admin-key', ADMIN_API_KEY);

            expect(res.status).toBe(200);
            expect(res.body.audit_logs.length).toBeLessThanOrEqual(5);
        });
    });
});
