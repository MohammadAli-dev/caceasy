/**
 * refreshAnalytics.ts
 * 
 * Cron job that runs computeAnalytics() to refresh analytics_daily table.
 * 
 * This should be scheduled to run daily (e.g., at midnight or early morning).
 * 
 * Usage:
 *   - Development: npm run start:cron
 *   - Production: node dist/cron/refreshAnalytics.js
 *   - Docker cron: Add to crontab or use external scheduler
 */

import { computeDayAnalytics, upsertAnalytics } from '../scripts/computeAnalytics';

async function refreshAnalytics() {
    console.log(`[${new Date().toISOString()}] Starting analytics refresh...`);

    try {
        // Refresh last 7 days by default
        const days = 7;
        const dates: string[] = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            dates.push(date.toISOString().split('T')[0]);
        }

        console.log(`Refreshing analytics for ${days} days: ${dates[0]} to ${dates[dates.length - 1]}`);

        for (const date of dates) {
            const analytics = await computeDayAnalytics(date);
            await upsertAnalytics(analytics);
            console.log(
                `  ✓ ${date}: Scans=${analytics.scans}, Masons=${analytics.active_masons}, ` +
                `Rate=${(analytics.redemption_rate * 100).toFixed(2)}%`
            );
        }

        console.log(`[${new Date().toISOString()}] Analytics refresh completed successfully.`);
        process.exit(0);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error refreshing analytics:`, error);
        process.exit(1);
    }
}

// Run immediately
refreshAnalytics();
