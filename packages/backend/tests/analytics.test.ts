import request from 'supertest';
import app from '../src/index';
import { query, getClient } from '../src/db';
import { computeDayAnalytics, upsertAnalytics } from '../src/scripts/computeAnalytics';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'test-admin-key-12345';

describe('Analytics Module Tests', () => {
    beforeAll(async () => {
        // Ensure analytics_daily table exists
        await query(`
            CREATE TABLE IF NOT EXISTS analytics_daily (
                date DATE PRIMARY KEY,
                scans INTEGER NOT NULL DEFAULT 0,
                active_masons INTEGER NOT NULL DEFAULT 0,
                redemptions INTEGER NOT NULL DEFAULT 0,
                redemption_rate FLOAT NOT NULL DEFAULT 0.0,
                top_regions JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
    });

    beforeEach(async () => {
        // Clean up ONLY today's test data, preserving seed data from previous days
        await query('DELETE FROM analytics_daily WHERE date = CURRENT_DATE');
        await query('DELETE FROM scans WHERE DATE(scanned_at) = CURRENT_DATE');
        await query('DELETE FROM transactions WHERE DATE(created_at) = CURRENT_DATE');

        // Clean up test coupons (tokens starting with TOKEN)
        await query("DELETE FROM coupons WHERE token LIKE 'TOKEN%'");

        // Clean up test users (phone numbers used in tests)
        await query("DELETE FROM users WHERE phone = '+15551234567'");
    });

    describe('computeAnalytics script', () => {
        it('should compute analytics for a day with no scans', async () => {
            const today = new Date().toISOString().split('T')[0];
            const analytics = await computeDayAnalytics(today);

            expect(analytics.date).toBe(today);
            expect(analytics.scans).toBe(0);
            expect(analytics.active_masons).toBe(0);
            expect(analytics.redemptions).toBe(0);
            expect(analytics.redemption_rate).toBe(0.0);
            expect(analytics.top_regions).toEqual([]);
        });

        it('should compute analytics for a day with scans', async () => {
            // Create test user
            const userResult = await query(
                `INSERT INTO users (phone, name) VALUES ($1, $2) RETURNING id`,
                ['+15551234567', 'Test Mason']
            );
            const userId = userResult.rows[0].id;

            // Create test batch and coupons
            const batchResult = await query(
                `INSERT INTO batches (name, sku, points_per_coupon, quantity) 
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                ['Test Batch', 'TEST-SKU', 100, 10]
            );
            const batchId = batchResult.rows[0].id;

            const timestamp = Date.now();
            const couponTokens = [`TOKEN-${timestamp}-1`, `TOKEN-${timestamp}-2`, `TOKEN-${timestamp}-3`];
            for (const token of couponTokens) {
                await query(
                    `INSERT INTO coupons (token, batch_id, points, status) VALUES ($1, $2, $3, $4)`,
                    [token, batchId, 100, 'issued']
                );
            }

            // Create test scans for today
            const today = new Date().toISOString().split('T')[0];
            const scanData = [
                { token: couponTokens[0], success: true, region: 'North' },
                { token: couponTokens[1], success: true, region: 'South' },
                { token: couponTokens[2], success: false, region: 'North' },
            ];

            for (const scan of scanData) {
                await query(
                    `INSERT INTO scans (token, user_id, scanned_at, success, gps) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        scan.token,
                        userId,
                        new Date(),
                        scan.success,
                        JSON.stringify({ region: scan.region, lat: 40.7, lon: -74.0 }),
                    ]
                );
            }

            // Compute analytics
            const analytics = await computeDayAnalytics(today);

            expect(analytics.date).toBe(today);
            expect(analytics.scans).toBe(3);
            expect(analytics.active_masons).toBe(1);
            expect(analytics.redemptions).toBe(2);
            expect(analytics.redemption_rate).toBeCloseTo(2 / 3, 2);
            expect(analytics.top_regions.length).toBeGreaterThan(0);
            expect(analytics.top_regions[0].region).toBe('North');
            expect(analytics.top_regions[0].count).toBe(2);
        });

        it('should upsert analytics into analytics_daily table', async () => {
            const today = new Date().toISOString().split('T')[0];
            const analytics = {
                date: today,
                scans: 100,
                active_masons: 50,
                redemptions: 80,
                redemption_rate: 0.8,
                top_regions: [{ region: 'North', count: 60 }, { region: 'South', count: 40 }],
            };

            await upsertAnalytics(analytics);

            // Verify it was inserted
            const result = await query('SELECT * FROM analytics_daily WHERE date = $1', [today]);
            expect(result.rows.length).toBe(1);
            expect(result.rows[0].scans).toBe(100);
            expect(result.rows[0].active_masons).toBe(50);
            expect(result.rows[0].redemptions).toBe(80);
            expect(parseFloat(result.rows[0].redemption_rate)).toBeCloseTo(0.8, 2);

            // Update with new data
            analytics.scans = 120;
            await upsertAnalytics(analytics);

            // Verify it was updated
            const updatedResult = await query('SELECT * FROM analytics_daily WHERE date = $1', [today]);
            expect(updatedResult.rows.length).toBe(1);
            expect(updatedResult.rows[0].scans).toBe(120);
        });
    });

    describe('GET /admin/analytics/overview', () => {
        it('should return analytics overview', async () => {
            // Insert test analytics data
            const today = new Date().toISOString().split('T')[0];
            await query(
                `INSERT INTO analytics_daily (date, scans, active_masons, redemptions, redemption_rate, top_regions)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (date) DO UPDATE SET
                    scans = EXCLUDED.scans,
                    active_masons = EXCLUDED.active_masons,
                    redemptions = EXCLUDED.redemptions,
                    redemption_rate = EXCLUDED.redemption_rate,
                    top_regions = EXCLUDED.top_regions`,
                [
                    today,
                    150,
                    60,
                    120,
                    0.8,
                    JSON.stringify([
                        { region: 'North', count: 50 },
                        { region: 'South', count: 40 },
                    ]),
                ]
            );

            const response = await request(app)
                .get('/admin/analytics/overview')
                .set('x-admin-api-key', ADMIN_API_KEY);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('scans_per_day');
            expect(response.body).toHaveProperty('active_masons');
            expect(response.body).toHaveProperty('redemption_rate');
            expect(response.body).toHaveProperty('pending_payouts_count');
            expect(response.body).toHaveProperty('top_regions');
            expect(response.body.scans_per_day).toBe(150);
            expect(response.body.active_masons).toBe(60);
            expect(response.body.top_regions.length).toBeGreaterThan(0);
        });

        it('should require admin API key', async () => {
            const response = await request(app).get('/admin/analytics/overview');
            expect(response.status).toBe(401);
        });
    });

    describe('GET /admin/analytics/daily', () => {
        it('should return daily time-series analytics', async () => {
            // Insert test data for 3 days
            const dates = [];
            for (let i = 2; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                dates.push(dateStr);

                await query(
                    `INSERT INTO analytics_daily (date, scans, active_masons, redemptions, redemption_rate, top_regions)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (date) DO UPDATE SET
                        scans = EXCLUDED.scans,
                        active_masons = EXCLUDED.active_masons,
                        redemptions = EXCLUDED.redemptions,
                        redemption_rate = EXCLUDED.redemption_rate,
                        top_regions = EXCLUDED.top_regions`,
                    [
                        dateStr,
                        100 + i * 10,
                        40 + i * 5,
                        80 + i * 8,
                        0.8,
                        JSON.stringify([{ region: 'North', count: 50 }]),
                    ]
                );
            }

            const response = await request(app)
                .get('/admin/analytics/daily?days=3')
                .set('x-admin-api-key', ADMIN_API_KEY);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('daily');
            expect(Array.isArray(response.body.daily)).toBe(true);
            expect(response.body.daily.length).toBeGreaterThanOrEqual(3);

            // Verify data structure
            const firstDay = response.body.daily[0];
            expect(firstDay).toHaveProperty('date');
            expect(firstDay).toHaveProperty('scans');
            expect(firstDay).toHaveProperty('active_masons');
            expect(firstDay).toHaveProperty('redemptions');
            expect(firstDay).toHaveProperty('redemption_rate');
        });

        it('should validate days parameter', async () => {
            const response = await request(app)
                .get('/admin/analytics/daily?days=500')
                .set('x-admin-api-key', ADMIN_API_KEY);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /admin/analytics/regions', () => {
        it('should return aggregated region analytics', async () => {
            // Insert test data
            const today = new Date().toISOString().split('T')[0];
            await query(
                `INSERT INTO analytics_daily (date, scans, active_masons, redemptions, redemption_rate, top_regions)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (date) DO UPDATE SET
                    scans = EXCLUDED.scans,
                    active_masons = EXCLUDED.active_masons,
                    redemptions = EXCLUDED.redemptions,
                    redemption_rate = EXCLUDED.redemption_rate,
                    top_regions = EXCLUDED.top_regions`,
                [
                    today,
                    150,
                    60,
                    120,
                    0.8,
                    JSON.stringify([
                        { region: 'North', count: 60 },
                        { region: 'South', count: 50 },
                        { region: 'East', count: 40 },
                    ]),
                ]
            );

            const response = await request(app)
                .get('/admin/analytics/regions?days=7')
                .set('x-admin-api-key', ADMIN_API_KEY);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('regions');
            expect(Array.isArray(response.body.regions)).toBe(true);

            if (response.body.regions.length > 0) {
                const firstRegion = response.body.regions[0];
                expect(firstRegion).toHaveProperty('region');
                expect(firstRegion).toHaveProperty('count');
            }
        });
    });
});
