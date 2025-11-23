#!/usr/bin/env ts-node
/**
 * computeAnalytics.ts
 * 
 * Aggregation script that computes daily analytics metrics and upserts them into analytics_daily table.
 * 
 * Usage:
 *   npm run compute:analytics -- --days=7
 *   ts-node -r tsconfig-paths/register src/scripts/computeAnalytics.ts --days=30
 * 
 * Metrics computed:
 * - scans: total scan count for the day
 * - active_masons: distinct users who scanned on the day
 * - redemptions: successful scans (success=true)
 * - redemption_rate: redemptions / scans (0 if no scans)
 * - top_regions: top 10 regions by scan count (from gps->>'region' or fallback)
 */

import { query, getClient } from '../db';

interface AnalyticsRow {
  date: string;
  scans: number;
  active_masons: number;
  redemptions: number;
  redemption_rate: number;
  top_regions: Array<{ region: string; count: number }>;
}

/**
 * Parse command-line arguments
 */
function parseArgs(): { days: number } {
  const args = process.argv.slice(2);
  let days = 7; // default

  for (const arg of args) {
    if (arg.startsWith('--days=')) {
      const value = parseInt(arg.split('=')[1], 10);
      if (!isNaN(value) && value > 0) {
        days = value;
      }
    }
  }

  return { days };
}

/**
 * Compute analytics for a single day
 */
async function computeDayAnalytics(date: string): Promise<AnalyticsRow> {
  // Query scans for the day
  const scansResult = await query(
    `SELECT COUNT(*) as total_scans FROM scans WHERE DATE(scanned_at) = $1`,
    [date]
  );
  const scans = parseInt(scansResult.rows[0]?.total_scans || '0', 10);

  // Query active masons (distinct users)
  const activeMasonsResult = await query(
    `SELECT COUNT(DISTINCT user_id) as active_masons FROM scans WHERE DATE(scanned_at) = $1 AND user_id IS NOT NULL`,
    [date]
  );
  const active_masons = parseInt(activeMasonsResult.rows[0]?.active_masons || '0', 10);

  // Query redemptions (successful scans)
  const redemptionsResult = await query(
    `SELECT COUNT(*) as redemptions FROM scans WHERE DATE(scanned_at) = $1 AND success = true`,
    [date]
  );
  const redemptions = parseInt(redemptionsResult.rows[0]?.redemptions || '0', 10);

  // Calculate redemption rate (guard divide-by-zero)
  const redemption_rate = scans > 0 ? redemptions / scans : 0.0;

  // Query top regions
  // Extract region from gps JSONB field (gps->>'region')
  // If gps is null or doesn't have region, use 'Unknown'
  const regionsResult = await query(
    `SELECT 
      COALESCE(gps->>'region', 'Unknown') as region,
      COUNT(*) as count
    FROM scans
    WHERE DATE(scanned_at) = $1
    GROUP BY region
    ORDER BY count DESC
    LIMIT 10`,
    [date]
  );

  const top_regions = regionsResult.rows.map((row: any) => ({
    region: row.region,
    count: parseInt(row.count, 10),
  }));

  return {
    date,
    scans,
    active_masons,
    redemptions,
    redemption_rate,
    top_regions,
  };
}

/**
 * Upsert analytics row into analytics_daily table
 */
async function upsertAnalytics(analytics: AnalyticsRow): Promise<void> {
  await query(
    `INSERT INTO analytics_daily (date, scans, active_masons, redemptions, redemption_rate, top_regions, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (date) 
     DO UPDATE SET 
       scans = EXCLUDED.scans,
       active_masons = EXCLUDED.active_masons,
       redemptions = EXCLUDED.redemptions,
       redemption_rate = EXCLUDED.redemption_rate,
       top_regions = EXCLUDED.top_regions,
       created_at = NOW()`,
    [
      analytics.date,
      analytics.scans,
      analytics.active_masons,
      analytics.redemptions,
      analytics.redemption_rate,
      JSON.stringify(analytics.top_regions),
    ]
  );
}

/**
 * Main function
 */
async function main() {
  const { days } = parseArgs();
  console.log(`Computing analytics for the last ${days} days...`);

  try {
    // Generate date range (last N days including today)
    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]); // YYYY-MM-DD
    }

    console.log(`Date range: ${dates[0]} to ${dates[dates.length - 1]}`);

    // Compute and upsert analytics for each day
    for (const date of dates) {
      console.log(`Processing ${date}...`);
      const analytics = await computeDayAnalytics(date);
      await upsertAnalytics(analytics);
      console.log(
        `  ✓ Scans: ${analytics.scans}, Active Masons: ${analytics.active_masons}, ` +
        `Redemptions: ${analytics.redemptions}, Rate: ${(analytics.redemption_rate * 100).toFixed(2)}%`
      );
    }

    console.log(`\n✅ Successfully computed analytics for ${days} days.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error computing analytics:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { computeDayAnalytics, upsertAnalytics };
