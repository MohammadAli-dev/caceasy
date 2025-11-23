import { Router, Request, Response } from 'express';
import { query as dbQuery } from '../db';
import { authenticateAdmin, rateLimitAdmin } from '../middleware/auth';

const router = Router();

// Apply admin auth and rate limiting to all routes
router.use(authenticateAdmin);
router.use(rateLimitAdmin);

// Helper function to write audit log
async function writeAudit(adminKey: string, action: string, payload: any) {
    try {
        await dbQuery(
            'INSERT INTO admin_audit (admin_identifier, action, payload) VALUES ($1, $2, $3)',
            [adminKey, action, JSON.stringify(payload)]
        );
    } catch (error) {
        console.error('Failed to write audit log:', error);
    }
}

// GET /admin/flagged - List flagged events with paging and filtering
router.get('/flagged', async (req: Request, res: Response) => {
    try {
        const {
            page = '1',
            limit = '20',
            batch_id,
            min_risk,
            max_risk,
            status = 'open',
            start_date,
            end_date,
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const offset = (pageNum - 1) * limitNum;

        // Build dynamic query
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (batch_id) {
            conditions.push(`batch_id = $${paramIndex++}`);
            params.push(batch_id);
        }
        if (min_risk) {
            conditions.push(`risk_score >= $${paramIndex++}`);
            params.push(parseInt(min_risk as string));
        }
        if (max_risk) {
            conditions.push(`risk_score <= $${paramIndex++}`);
            params.push(parseInt(max_risk as string));
        }
        if (status) {
            conditions.push(`status = $${paramIndex++}`);
            params.push(status);
        }
        if (start_date) {
            conditions.push(`created_at >= $${paramIndex++}`);
            params.push(start_date);
        }
        if (end_date) {
            conditions.push(`created_at <= $${paramIndex++}`);
            params.push(end_date);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        // Get total count
        const countResult = await dbQuery(
            `SELECT COUNT(*) FROM flagged_events ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Get paginated results
        const result = await dbQuery(
            `SELECT fe.*, u.phone as user_phone, b.name as batch_name
             FROM flagged_events fe
             LEFT JOIN users u ON fe.user_id = u.id
             LEFT JOIN batches b ON fe.batch_id = b.id
             ${whereClause}
             ORDER BY fe.created_at DESC
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limitNum, offset]
        );

        res.json({
            flagged: result.rows,
            total,
            page: pageNum,
            limit: limitNum,
        });
    } catch (error) {
        console.error('Error fetching flagged events:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /admin/flagged/:id/resolve - Resolve a flagged event
router.post('/flagged/:id/resolve', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { action, notes } = req.body;
        const adminKey = (req as any).adminKey;

        if (!action || !notes) {
            return res.status(400).json({ error: 'action and notes are required' });
        }

        // Update flagged event
        const result = await dbQuery(
            `UPDATE flagged_events
             SET status = 'resolved', resolved_by = $1, resolved_at = NOW(), notes = $2
             WHERE id = $3
             RETURNING *`,
            [adminKey, notes, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Flagged event not found' });
        }

        // Write audit log
        await writeAudit(adminKey, 'flagged_event_resolved', {
            flagged_event_id: id,
            action,
            notes,
        });

        res.json({ message: 'Flagged event resolved', event: result.rows[0] });
    } catch (error) {
        console.error('Error resolving flagged event:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /admin/payouts - List payouts with optional status filter
router.get('/payouts', async (req: Request, res: Response) => {
    try {
        const { status } = req.query;

        let result;
        if (status) {
            result = await dbQuery(
                `SELECT p.*, u.phone as user_phone
                 FROM payouts p
                 LEFT JOIN users u ON p.user_id = u.id
                 WHERE p.status = $1
                 ORDER BY p.created_at DESC`,
                [status]
            );
        } else {
            result = await dbQuery(
                `SELECT p.*, u.phone as user_phone
                 FROM payouts p
                 LEFT JOIN users u ON p.user_id = u.id
                 ORDER BY p.created_at DESC`
            );
        }

        res.json({ payouts: result.rows });
    } catch (error) {
        console.error('Error fetching payouts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /admin/payouts/:id/approve - Approve a payout
router.post('/payouts/:id/approve', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reference } = req.body;
        const adminKey = (req as any).adminKey;

        if (!reference) {
            return res.status(400).json({ error: 'reference is required' });
        }

        const result = await dbQuery(
            `UPDATE payouts
             SET status = 'approved', reference = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [reference, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payout not found' });
        }

        // Write audit log
        await writeAudit(adminKey, 'payout_approved', {
            payout_id: id,
            reference,
            amount: result.rows[0].amount,
        });

        res.json({ message: 'Payout approved', payout: result.rows[0] });
    } catch (error) {
        console.error('Error approving payout:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /admin/payouts/:id/reject - Reject a payout
router.post('/payouts/:id/reject', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const adminKey = (req as any).adminKey;

        if (!notes) {
            return res.status(400).json({ error: 'notes are required' });
        }

        const result = await dbQuery(
            `UPDATE payouts
             SET status = 'rejected', reference = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [notes, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payout not found' });
        }

        // Write audit log
        await writeAudit(adminKey, 'payout_rejected', {
            payout_id: id,
            notes,
        });

        res.json({ message: 'Payout rejected', payout: result.rows[0] });
    } catch (error) {
        console.error('Error rejecting payout:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /admin/analytics - Get KPIs
router.get('/analytics', async (req: Request, res: Response) => {
    try {
        // Scans per day (average over last 7 days)
        const scansResult = await dbQuery(`
            SELECT COALESCE(CAST(COUNT(*) AS FLOAT) / 7, 0) as scans_per_day
            FROM scans
            WHERE scanned_at > NOW() - INTERVAL '7 days'
        `);

        // Active masons (users who scanned in last 30 days)
        const masonsResult = await dbQuery(`
            SELECT COUNT(DISTINCT user_id) as active_masons
            FROM scans
            WHERE scanned_at > NOW() - INTERVAL '30 days'
        `);

        // Redemption rate (successful scans / total scans)
        const redemptionResult = await dbQuery(`
            SELECT 
                COUNT(*) FILTER (WHERE success = true) as successful,
                COUNT(*) as total
            FROM scans
            WHERE scanned_at > NOW() - INTERVAL '30 days'
        `);

        const redemptionRate = redemptionResult.rows[0].total > 0
            ? parseFloat((redemptionResult.rows[0].successful / redemptionResult.rows[0].total).toFixed(2))
            : 0;

        // Pending payouts count
        const payoutsResult = await dbQuery(`
            SELECT COUNT(*) as pending_payouts_count
            FROM payouts
            WHERE status = 'pending'
        `);

        // Top regions (from GPS data)
        const regionsResult = await dbQuery(`
            SELECT 
                COALESCE(gps->>'region', 'Unknown') as region,
                COUNT(*) as count
            FROM scans
            WHERE scanned_at > NOW() - INTERVAL '30 days'
            GROUP BY gps->>'region'
            ORDER BY count DESC
            LIMIT 5
        `);

        res.json({
            scans_per_day: Math.round(parseFloat(scansResult.rows[0].scans_per_day)),
            active_masons: parseInt(masonsResult.rows[0].active_masons),
            redemption_rate: redemptionRate,
            pending_payouts_count: parseInt(payoutsResult.rows[0].pending_payouts_count),
            top_regions: regionsResult.rows,
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /admin/batches - List all batches with counts
router.get('/batches', async (req: Request, res: Response) => {
    try {
        const result = await dbQuery(`
            SELECT 
                b.id,
                b.name,
                b.sku,
                b.points_per_coupon,
                b.quantity,
                b.created_at,
                COUNT(c.token) as issued,
                COUNT(c.token) FILTER (WHERE c.status = 'redeemed') as redeemed,
                COUNT(c.token) FILTER (WHERE c.status = 'issued') as pending
            FROM batches b
            LEFT JOIN coupons c ON b.id = c.batch_id
            GROUP BY b.id
            ORDER BY b.created_at DESC
        `);

        res.json({ batches: result.rows });
    } catch (error) {
        console.error('Error fetching batches:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /admin/batch - Create a new batch
router.post('/batch', async (req: Request, res: Response) => {
    try {
        const { name, sku, points_per_scan, expiry_date, quantity } = req.body;
        const adminKey = (req as any).adminKey;

        if (!name || !sku || !points_per_scan) {
            return res.status(400).json({
                error: 'name, sku, and points_per_scan are required',
            });
        }

        const result = await dbQuery(
            `INSERT INTO batches (name, sku, points_per_coupon, quantity)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, sku, points_per_scan, quantity || 0]
        );

        // Write audit log
        await writeAudit(adminKey, 'batch_created', {
            batch_id: result.rows[0].id,
            name,
            sku,
            points_per_scan,
        });

        res.status(201).json({ message: 'Batch created', batch: result.rows[0] });
    } catch (error) {
        console.error('Error creating batch:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /admin/audit - Get recent audit logs
router.get('/audit', async (req: Request, res: Response) => {
    try {
        const { limit = '50' } = req.query;
        const result = await dbQuery(
            `SELECT * FROM admin_audit
             ORDER BY created_at DESC
             LIMIT $1`,
            [parseInt(limit as string)]
        );

        res.json({ audit_logs: result.rows });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /admin/dealer-payouts - List dealer payouts
router.get('/dealer-payouts', async (req: Request, res: Response) => {
    try {
        const result = await dbQuery(
            `SELECT p.*, d.name as dealer_name, d.phone as dealer_phone, d.gst as dealer_gst
             FROM payouts p
             JOIN dealers d ON p.dealer_id = d.id
             WHERE p.type = 'dealer'
             ORDER BY p.created_at DESC`
        );
        res.json({ payouts: result.rows });
    } catch (error) {
        console.error('Error fetching dealer payouts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /admin/dealer-payouts/:id/approve - Approve dealer payout
router.post('/dealer-payouts/:id/approve', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reference } = req.body;
        const adminKey = (req as any).adminKey;

        if (!reference) {
            return res.status(400).json({ error: 'reference is required' });
        }

        const result = await dbQuery(
            `UPDATE payouts
             SET status = 'approved', reference = $1, updated_at = NOW()
             WHERE id = $2 AND type = 'dealer'
             RETURNING *`,
            [reference, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payout not found' });
        }

        // Write audit log
        await writeAudit(adminKey, 'dealer_payout_approved', {
            payout_id: id,
            reference,
            amount: result.rows[0].amount,
        });

        res.json({ message: 'Payout approved', payout: result.rows[0] });
    } catch (error) {
        console.error('Error approving dealer payout:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /admin/dealer-payouts/export - Export approved payouts to CSV
router.get('/dealer-payouts/export', async (req: Request, res: Response) => {
    try {
        const result = await dbQuery(
            `SELECT p.id, p.amount, p.status, p.created_at, p.reference, 
                    d.name, d.phone, d.gst
             FROM payouts p
             JOIN dealers d ON p.dealer_id = d.id
             WHERE p.type = 'dealer' AND p.status = 'approved'
             ORDER BY p.created_at DESC`
        );

        const fields = ['id', 'amount', 'status', 'created_at', 'reference', 'name', 'phone', 'gst'];
        const csv = [
            fields.join(','),
            ...result.rows.map(row => fields.map(field => JSON.stringify(row[field])).join(','))
        ].join('\n');

        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', 'attachment; filename=dealer_payouts.csv');
        res.send(csv);
    } catch (error) {
        console.error('Error exporting dealer payouts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
