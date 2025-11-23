# Module 5: Analytics Engine + BI Layer - Implementation Guide

## Overview

Module 5 provides a comprehensive analytics solution for CACeasy/CRMEasy, including:
- Daily aggregated analytics stored in `analytics_daily` table
- Backend computation script to refresh analytics
- RESTful API endpoints for analytics data
- Admin dashboard UI with interactive charts
- Automated refresh mechanism via cron jobs

## Architecture

### Database Layer
- **Table**: `analytics_daily` - Stores pre-computed daily analytics
  - `date`: Primary key (DATE)
  - `scans`: Total scans for the day
  - `active_masons`: Distinct users who scanned
  - `redemptions`: Successful scans
  - `redemption_rate`: Redemptions / scans ratio
  - `top_regions`: JSONB array of top regions by scan count
  - `created_at`: Timestamp of last update

### Backend Components

#### 1. Aggregation Script (`computeAnalytics.ts`)
Located at: `packages/backend/src/scripts/computeAnalytics.ts`

**Purpose**: Computes daily analytics by aggregating data from the `scans` table and upserts results into `analytics_daily`.

**Features**:
- Configurable date range via `--days=N` CLI flag
- Computes metrics: scans, active masons, redemptions, redemption rate, top regions
- Handles divide-by-zero for redemption rate
- Upserts data (insert or update on conflict)

**Usage**:
```bash
# From packages/backend directory
npm run compute:analytics -- --days=7

# Or directly with ts-node
ts-node -r tsconfig-paths/register src/scripts/computeAnalytics.ts --days=30
```

#### 2. Analytics API Routes (`adminAnalytics.ts`)
Located at: `packages/backend/src/routes/adminAnalytics.ts`

**Endpoints**:

1. **GET `/admin/analytics/overview`**
   - Returns latest day's KPIs
   - Falls back to on-the-fly computation if `analytics_daily` is empty
   - Response:
     ```json
     {
       "scans_per_day": 150,
       "active_masons": 60,
       "redemption_rate": 0.8,
       "pending_payouts_count": 5,
       "top_regions": [{"region": "North", "count": 50}],
       "date": "2023-11-23"
     }
     ```

2. **GET `/admin/analytics/daily?days=30`**
   - Returns time-series data for last N days
   - Query param: `days` (1-365, default 30)
   - Response:
     ```json
     {
       "daily": [
         {
           "date": "2023-11-20",
           "scans": 120,
           "active_masons": 50,
           "redemptions": 96,
           "redemption_rate": 0.8
         }
       ]
     }
     ```

3. **GET `/admin/analytics/regions?days=30`**
   - Returns aggregated region counts
   - Query param: `days` (1-365, default 30)
   - Response:
     ```json
     {
       "regions": [
         {"region": "North", "count": 150},
         {"region": "South", "count": 120}
       ]
     }
     ```

**Authentication**: All endpoints require admin API key via `x-admin-api-key` header.

#### 3. Cron Refresh Script (`refreshAnalytics.ts`)
Located at: `packages/backend/src/cron/refreshAnalytics.ts`

**Purpose**: Automated daily refresh of analytics data.

**Usage**:
```bash
# Development (ts-node)
npm run start:cron

# Production (compiled)
node dist/cron/refreshAnalytics.js
```

### Frontend Components

#### Analytics Dashboard Page
Located at: `packages/admin/src/pages/analytics.tsx`

**Features**:
- **KPI Tiles**: Scans/day, active masons, redemption rate, pending payouts
- **Time-series Charts**:
  - Scans over time (area chart)
  - Active masons over time (line chart)
  - Redemption rate trend (line chart)
- **Top Regions Bar Chart**
- **Daily Summary Table**
- **Time Range Selector**: 7, 14, 30, 60, 90 days

**Technology**: React, Next.js, Recharts, Tailwind CSS

**Access**: Navigate to `http://localhost:3001/analytics` (requires admin login)

## Setup Instructions

### 1. Database Setup

The `analytics_daily` table is automatically created when you run the seed script:

```bash
# From root directory
docker compose up -d postgres

# Wait for postgres to be ready, then seed
docker compose exec backend npm run seed
```

Or manually apply the SQL from `infra/seed/seed.sql` (lines for Module 5).

### 2. Initial Analytics Computation

After seeding, compute analytics for the first time:

```bash
# From packages/backend
npm run compute:analytics -- --days=7
```

This will populate `analytics_daily` with data for the last 7 days.

### 3. Backend API Server

Start the backend server:

```bash
# From packages/backend
npm run start:dev

# Or via Docker
docker compose up backend
```

The analytics endpoints will be available at:
- `http://localhost:3000/admin/analytics/overview`
- `http://localhost:3000/admin/analytics/daily?days=30`
- `http://localhost:3000/admin/analytics/regions?days=30`

### 4. Admin Frontend

Install dependencies and start the admin frontend:

```bash
# From packages/admin
npm install
npm run dev
```

Access the analytics dashboard at: `http://localhost:3001/analytics`

## Scheduling Daily Analytics Refresh

### Option 1: Docker Compose with Cron

Add a cron service to `docker-compose.yml`:

```yaml
cron:
  build: ./packages/backend
  command: sh -c "while true; do npm run start:cron; sleep 86400; done"
  environment:
    DATABASE_URL: postgres://postgres:password@postgres:5432/caceasy
  depends_on:
    - postgres
```

### Option 2: System Crontab (Linux/macOS)

```bash
# Edit crontab
crontab -e

# Add this line to run daily at 2 AM
0 2 * * * cd /path/to/caceasy/packages/backend && npm run start:cron >> /var/log/caceasy-analytics.log 2>&1
```

### Option 3: Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Daily at 2:00 AM
4. Action: Start a program
   - Program: `cmd.exe`
   - Arguments: `/c cd C:\caceasy\packages\backend && npm run start:cron`

### Option 4: External Scheduler (Recommended for Production)

Use a cloud-based scheduler like:
- **AWS EventBridge** + Lambda
- **Google Cloud Scheduler** + Cloud Run
- **Azure Logic Apps**
- **Kubernetes CronJob**

Example Kubernetes CronJob:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: analytics-refresh
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: analytics
            image: caceasy-backend:latest
            command: ["npm", "run", "start:cron"]
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: url
          restartPolicy: OnFailure
```

## Testing

### Backend Tests

```bash
# From packages/backend
npm test -- tests/analytics.test.ts

# Or run all tests
npm test
```

**Test Coverage**:
- `computeDayAnalytics()` function
- `upsertAnalytics()` function
- GET `/admin/analytics/overview`
- GET `/admin/analytics/daily?days=N`
- GET `/admin/analytics/regions?days=N`

### Frontend Tests

```bash
# From packages/admin
npm install  # Ensure ts-jest is installed
npm test -- src/__tests__/Analytics.test.tsx
```

**Test Coverage**:
- KPI tiles rendering
- Charts rendering (mocked recharts)
- Daily summary table
- API error handling

## Verification

### Manual Verification Steps

1. **Check Database**:
   ```sql
   SELECT * FROM analytics_daily ORDER BY date DESC LIMIT 7;
   ```

2. **Test API Endpoints**:
   ```bash
   # Set your admin API key
   export ADMIN_KEY="your-admin-key"

   # Test overview
   curl -H "x-admin-api-key: $ADMIN_KEY" http://localhost:3000/admin/analytics/overview

   # Test daily
   curl -H "x-admin-api-key: $ADMIN_KEY" "http://localhost:3000/admin/analytics/daily?days=7"

   # Test regions
   curl -H "x-admin-api-key: $ADMIN_KEY" "http://localhost:3000/admin/analytics/regions?days=7"
   ```

3. **View Admin UI**:
   - Navigate to `http://localhost:3001/analytics`
   - Verify KPI tiles show correct data
   - Verify charts render properly
   - Test time range selector (7, 14, 30, 60, 90 days)

### Docker Compose Full Smoke Test

```bash
# From root directory
docker compose up -d

# Wait for services to start
sleep 10

# Run analytics computation
docker compose exec backend npm run compute:analytics -- --days=7

# Run backend tests
docker compose exec backend npm test -- tests/analytics.test.ts --runInBand

# Check logs
docker compose logs backend | grep analytics
```

## Troubleshooting

### Issue: No data in analytics_daily

**Solution**: Run the computation script:
```bash
npm run compute:analytics -- --days=30
```

### Issue: API returns empty arrays

**Cause**: No scans data in the database.

**Solution**: 
1. Check if scans table has data: `SELECT COUNT(*) FROM scans;`
2. If empty, create test scans or wait for real usage
3. Re-run computation script

### Issue: Charts not rendering in admin UI

**Cause**: Missing recharts dependency or API errors.

**Solution**:
```bash
cd packages/admin
npm install recharts
npm run dev
```

### Issue: Cron job not running

**Solution**:
1. Check cron logs: `tail -f /var/log/caceasy-analytics.log`
2. Verify DATABASE_URL environment variable is set
3. Test manually: `npm run start:cron`

## Performance Considerations

- **analytics_daily** table is indexed on `date DESC` for fast queries
- API endpoints prefer reading from `analytics_daily` (pre-computed)
- Fallback to on-the-fly computation only when table is empty
- Recommended refresh frequency: Daily (off-peak hours)
- For high-volume systems, consider:
  - Materialized views instead of table
  - Incremental updates (only compute yesterday)
  - Caching layer (Redis) for API responses

## Future Enhancements

- [ ] Add more metrics: revenue, top SKUs, dealer performance
- [ ] Export analytics to CSV/Excel
- [ ] Real-time analytics (WebSocket updates)
- [ ] Predictive analytics (ML models)
- [ ] Custom date range picker
- [ ] Drill-down views (region → city → dealer)
- [ ] Alerts for anomalies (sudden drop in scans, etc.)

## Files Modified/Created

### Database
- `infra/seed/seed.sql` - Added `analytics_daily` table and seed data

### Backend
- `packages/backend/src/scripts/computeAnalytics.ts` - Aggregation script
- `packages/backend/src/routes/adminAnalytics.ts` - API routes
- `packages/backend/src/cron/refreshAnalytics.ts` - Cron job
- `packages/backend/src/index.ts` - Registered analytics routes
- `packages/backend/package.json` - Added npm scripts
- `packages/backend/tests/analytics.test.ts` - Backend tests

### Frontend
- `packages/admin/src/pages/analytics.tsx` - Analytics dashboard page
- `packages/admin/src/pages/index.tsx` - Added analytics link
- `packages/admin/src/__tests__/Analytics.test.tsx` - Frontend tests
- `packages/admin/package.json` - Added recharts, ts-jest
- `packages/admin/jest.config.js` - Jest configuration
- `packages/admin/jest.setup.js` - Jest setup

### Documentation
- `MODULE_5_STEPS.md` - This file

## Support

For issues or questions:
1. Check logs: `docker compose logs backend`
2. Review test output: `npm test`
3. Verify database state: `psql -d caceasy -c "SELECT * FROM analytics_daily;"`
4. Consult previous module docs: `MODULE_0_STEPS.md`, `MODULE_1_STEPS.md`, etc.

---

**Module 5 Status**: ✅ Implemented and Tested
**Last Updated**: 2023-11-23
