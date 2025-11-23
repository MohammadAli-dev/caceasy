# Admin Dashboard - Module 3

## Overview
Production-ready Admin Dashboard for CACeasy with secure API-key authentication, comprehensive admin functionality for managing flagged events, payouts, batches, and analytics.

## Features

### Backend API
- **Authentication**: Header-based API key (`x-admin-key`)
- **Rate Limiting**: 20 requests per minute per IP
- **Audit Logging**: All admin actions logged to `admin_audit` table

### Endpoints
- `GET /admin/flagged` - List flagged events (with paging/filtering)
- `POST /admin/flagged/{id}/resolve` - Resolve flagged event
- `GET /admin/payouts?status=pending` - List payouts
- `POST /admin/payouts/{id}/approve` - Approve payout
- `POST /admin/payouts/{id}/reject` - Reject payout
- `GET /admin/analytics` - Get KPIs (scans/day, active masons, redemption rate, etc.)
- `GET /admin/batches` - List batches with counts
- `POST /admin/batch` - Create batch
- `GET /admin/audit` - View audit logs

### Frontend Pages
- **Login**: API key authentication with validation
- **Dashboard**: KPI tiles, top regions, quick actions
- **Flagged Events**: Table view with resolve modal
- **Payouts**: Bulk approve, CSV export
- **Batches**: Create batch, view counts

## Setup Instructions

### Environment Variables
Add to your `.env` file:
```bash
ADMIN_API_KEY=your-secret-admin-key-here
```

> **IMPORTANT**: Set a strong API key in production. The server will fail to start if using the default dev key in production.

### Database Migration
The database schema is automatically applied via `infra/seed/seed.sql`. New tables:
- `flagged_events` - Stores flagged scans/events
- `admin_audit` - Logs all admin actions

To apply schema changes:
```bash
docker compose down -v
docker compose up --build -d
```

### Running the Admin Frontend

#### Development
```bash
cd packages/admin
npm install
npm run dev
```
The admin dashboard will be available at `http://localhost:3001`

#### Production Build
```bash
cd packages/admin
npm install
npm run build
npm run start
```

### Docker Compose
The admin frontend is included in `docker-compose.yml`:
```yaml
admin:
  build: ./packages/admin
  ports:
    - "3001:3001"
  environment:
    - NEXT_PUBLIC_API_URL=http://backend:3000
```

## Usage

### Login
1. Navigate to `http://localhost:3001/login`
2. Enter your `ADMIN_API_KEY`
3. The key is validated against the backend and stored in sessionStorage

### Managing Flagged Events
1. View flagged events on the Flagged Events page
2. Click "Resolve" on any event
3. Add notes and confirm
4. Event status updates to "resolved" and audit log is created

### Approving Payouts
1. Navigate to Payouts page
2. Select payouts using checkboxes
3. Click "Approve Selected" for bulk approval, or "Approve" on individual rows
4. Enter a reference number (e.g., bank transaction ID)
5. Export CSV for bank upload using "Export CSV" button

### Creating Batches
1. Navigate to Batch Management page
2. Click "Create Batch"
3. Fill in batch details (name, SKU, points per scan, quantity)
4. After creation, you can generate coupons via the coupons endpoint

## Testing

### Backend Tests
```bash
cd packages/backend
npm test -- admin
```

Expected output:
- All admin endpoints return 401 without API key ✅
- GET /admin/flagged returns data ✅
- POST /admin/flagged/{id}/resolve updates status & creates audit ✅
- POST /admin/payouts/{id}/approve transitions payout ✅
- GET /admin/analytics returns KPIs ✅

### Frontend Tests
``bash
cd packages/admin
npm test
```

## Example cURL Commands

### Get Analytics (requires API key)
```bash
curl http://localhost:3000/admin/analytics \
  -H "x-admin-key: your-secret-admin-key-here"
```

Expected response:
```json
{
  "scans_per_day": 1250,
  "active_masons": 45,
  "redemption_rate": 0.73,
  "pending_payouts_count": 12,
  "top_regions": [
    {"region": "Delhi", "count": 450},
    {"region": "Mumbai", "count": 380}
  ]
}
```

### List Pending Payouts
```bash
curl http://localhost:3000/admin/payouts?status=pending \
  -H "x-admin-key: your-secret-admin-key-here"
```

### Approve a Payout
```bash
curl -X POST http://localhost:3000/admin/payouts/{payout-id}/approve \
  -H "x-admin-key: your-secret-admin-key-here" \
  -H "Content-Type: application/json" \
  -d '{"reference": "TXN12345"}'
```

### Resolve Flagged Event
```bash
curl -X POST http://localhost:3000/admin/flagged/{event-id}/resolve \
  -H "x-admin-key: your-secret-admin-key-here" \
  -H "Content-Type: application/json" \
  -d '{"action": "verified_legitimate", "notes": "Verified with user"}'
```

## Security Considerations

- **API Key Storage**: Admin API key is stored in sessionStorage (cleared on tab close)
- **HTTPS Required**: Always use HTTPS in production
- **Rate Limiting**: Built-in rate limiting prevents brute force attacks (20 req/min)
- **Audit Trail**: All admin actions are logged with admin identifier, action, and payload
- **CSV Export**: Only exposes necessary data (phone last 4 digits, amount, status)

## Architecture

### Backend
- **Auth Middleware**: `authenticateAdmin` validates API key from header
- **Rate Limiter**: In-memory store tracks requests per IP
- **Audit Helper**: `writeAudit()` function logs all admin actions to DB

### Frontend
- **API Client**: Axios instance with interceptors for automatic API key injection
- **Session Management**: API key in sessionStorage, auto-redirect to login on 401
- **Toast Notifications**: react-hot-toast for user feedback

## Troubleshooting

**Problem**: "Unauthorized" error on admin endpoints
- **Solution**: Ensure `ADMIN_API_KEY` is set in backend `.env` and matches the key you're using

**Problem**: Frontend can't reach backend
- **Solution**: Set `NEXT_PUBLIC_API_URL=http://localhost:3000` in frontend `.env.local`

**Problem**: Rate limit exceeded
- **Solution**: Wait 1 minute or restart the backend to clear in-memory rate limit store

**Problem**: Database tables not found
- **Solution**: Run `docker compose down -v && docker compose up --build -d` to recreate DB with new schema

## Next Steps

- Add more chart visualizations to Analytics page
- Implement audit log viewer page  
- Add email notifications for flagged events
- Implement batch coupon generation UI
- Add user management (create admin users vs. single API key)
