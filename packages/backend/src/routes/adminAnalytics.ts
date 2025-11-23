import { Router, Request, Response } from 'express';
import { query as dbQuery } from '../db';
import { authenticateAdmin, rateLimitAdmin } from '../middleware/auth';

const router = Router();

// Apply admin auth and rate limiting to all routes
router.use(authenticateAdmin);
router.use(rateLimitAdmin);

/**
 * GET /admin/analytics/overview
 * Returns overview KPIs for the last 24 hours (or latest day in analytics_daily)
 */
router.get('/overview', async (req: Request, res: Response) => {
    try {
        // Try to get latest analytics from analytics_daily table
        const latestResult = await dbQuery(
            `SELECT * FROM analytics_daily ORDER BY date DESC LIMIT 1`
        );

        if (latestResult.rows.length > 0) {
            const latest = latestResult.rows[0];

            // Get pending payouts count
            const payoutsResult = await dbQuery(
                `SELECT COUNT(*) as pending_payouts_count FROM payouts WHERE status = 'pending'`
            );

            return res.json({
                scans_per_day: latest.scans,
                active_masons: latest.active_masons,
                redemption_rate: parseFloat(latest.redemption_rate.toFixed(3)),
                pending_payouts_count: parseInt(payoutsResult.rows[0].pending_payouts_count),
                top_regions: latest.top_regions || [],
                date: latest.date,
            });
        }

        // Fallback: compute on-the-fly for last 24 hours
        const scansResult = await dbQuery(`
            SELECT COUNT(*) as scans FROM scans WHERE scanned_at > NOW() - INTERVAL '1 day'
        `);

        const masonsResult = await dbQuery(`
            SELECT COUNT(DISTINCT user_id) as active_masons 
            FROM scans 
            WHERE scanned_at > NOW() - INTERVAL '1 day' AND user_id IS NOT NULL
        `);

        const redemptionsResult = await dbQuery(`
            SELECT COUNT(*) as redemptions 
            FROM scans 
            WHERE scanned_at > NOW() - INTERVAL '1 day' AND success = true
        `);

        const scans = parseInt(scansResult.rows[0].scans);
        const redemptions = parseInt(redemptionsResult.rows[0].redemptions);
        const redemption_rate = scans > 0 ? redemptions / scans : 0.0;

        const payoutsResult = await dbQuery(
            `SELECT COUNT(*) as pending_payouts_count FROM payouts WHERE status = 'pending'`
        );

        const regionsResult = await dbQuery(`
            SELECT 
                COALESCE(gps->>'region', 'Unknown') as region,
                COUNT(*) as count
            FROM scans
            WHERE scanned_at > NOW() - INTERVAL '1 day'
            GROUP BY gps->>'region'
            ORDER BY count DESC
            LIMIT 10
        `);

        res.json({
            scans_per_day: scans,
            active_masons: parseInt(masonsResult.rows[0].active_masons),
            redemption_rate: parseFloat(redemption_rate.toFixed(3)),
            pending_payouts_count: parseInt(payoutsResult.rows[0].pending_payouts_count),
            top_regions: regionsResult.rows.map((row: any) => ({
                region: row.region,
                count: parseInt(row.count),
            })),
            date: new Date().toISOString().split('T')[0],
        });
    } catch (error) {
        console.error('Error fetching analytics overview:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /admin/analytics/daily?days=30
 * Returns time-series analytics data for the last N days
 */
router.get('/daily', async (req: Request, res: Response) => {
    try {
        const days = parseInt((req.query.days as string) || '30');

        if (days <= 0 || days > 365) {
            return res.status(400).json({ error: 'days must be between 1 and 365' });
        }

        // Query analytics_daily table
        const result = await dbQuery(
            `SELECT date, scans, active_masons, redemptions, redemption_rate, top_regions
             FROM analytics_daily
             WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
             ORDER BY date ASC`
        );

        // If we have data, return it
        if (result.rows.length > 0) {
            return res.json({
                daily: result.rows.map((row: any) => ({
                    date: row.date,
                    scans: row.scans,
                    active_masons: row.active_masons,
                    redemptions: row.redemptions,
                    redemption_rate: parseFloat(row.redemption_rate.toFixed(3)),
                })),
            });
        }

        // Fallback: compute on-the-fly from scans table
        const fallbackResult = await dbQuery(`
            WITH daily_stats AS (
                SELECT 
                    DATE(scanned_at) as date,
                    COUNT(*) as scans,
                    COUNT(DISTINCT user_id) as active_masons,
                    COUNT(*) FILTER (WHERE success = true) as redemptions
                FROM scans
                WHERE scanned_at >= CURRENT_DATE - INTERVAL '${days} days'
                GROUP BY DATE(scanned_at)
                ORDER BY date ASC
            )
            SELECT 
                date,
                scans,
                active_masons,
                redemptions,
                CASE WHEN scans > 0 THEN CAST(redemptions AS FLOAT) / scans ELSE 0.0 END as redemption_rate
            FROM daily_stats
        `);

        res.json({
            daily: fallbackResult.rows.map((row: any) => ({
                date: row.date,
                scans: parseInt(row.scans),
                active_masons: parseInt(row.active_masons),
                redemptions: parseInt(row.redemptions),
                redemption_rate: parseFloat(row.redemption_rate.toFixed(3)),
            })),
        });
    } catch (error) {
        console.error('Error fetching daily analytics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /admin/analytics/regions?days=30
 * Returns aggregated region counts for the last N days
 */
router.get('/regions', async (req: Request, res: Response) => {
    try {
        const days = parseInt((req.query.days as string) || '30');

        if (days <= 0 || days > 365) {
            return res.status(400).json({ error: 'days must be between 1 and 365' });
        }

        // Try to aggregate from analytics_daily table
        const analyticsResult = await dbQuery(
            `SELECT top_regions FROM analytics_daily 
             WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
             ORDER BY date DESC`
        );

        if (analyticsResult.rows.length > 0) {
            // Aggregate top_regions from all days
            const regionMap = new Map<string, number>();

            for (const row of analyticsResult.rows) {
                if (row.top_regions && Array.isArray(row.top_regions)) {
                    for (const regionData of row.top_regions) {
                        const current = regionMap.get(regionData.region) || 0;
                        regionMap.set(regionData.region, current + regionData.count);
                    }
                }
            }

            const regions = Array.from(regionMap.entries())
                .map(([region, count]) => ({ region, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            return res.json({ regions });
        }

        // Fallback: query scans table directly
        const fallbackResult = await dbQuery(`
            SELECT 
                COALESCE(gps->>'region', 'Unknown') as region,
                COUNT(*) as count
            FROM scans
            WHERE scanned_at >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY gps->>'region'
            ORDER BY count DESC
            LIMIT 10
        `);

        res.json({
            regions: fallbackResult.rows.map((row: any) => ({
                region: row.region,
                count: parseInt(row.count),
            })),
        });
    } catch (error) {
        console.error('Error fetching region analytics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
