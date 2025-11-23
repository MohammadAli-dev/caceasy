# Module 4: Dealer / Proxy Scanning + Payout Automation

## Overview

This module introduces dealer functionality, enabling dealers to scan coupons on behalf of masons (proxy scanning) and manage their wallet balances and reimbursements.

---

## What Was Built

### 1. Database Schema

**New Tables:**
- `dealers` - Stores dealer information (name, phone, GST)
- `dealer_transactions` - Tracks dealer wallet transactions (credits, debits, payouts, reimbursement requests)

**Modified Tables:**
- `transactions` - Added `dealer_id` column to track dealer involvement
- `scans` - Added `dealer_id` column to track which dealer performed the scan
- `payouts` - Added `type` (user/dealer) and `dealer_id` columns, made `user_id` nullable

**Seed Data:**
- Sample dealer account: `+919876543210` (Test Dealer)
- Sample pending dealer payout

**Files Modified:**
- `infra/seed/seed.sql`

---

### 2. Backend Dealer API

**Authentication:**
- Modified `POST /auth/verify` to check if phone belongs to a dealer
- Issues JWT with `role='dealer'` for dealer accounts
- Updated JWT middleware to include and validate `role` field

**New Endpoints:**

#### `POST /dealer/register`
Register a new dealer with name, phone, and optional GST number.

**Request:**
```json
{
  "name": "Dealer Name",
  "phone": "+919876543210",
  "gst": "GST29ABCDE1234F1Z5"
}
```

#### `POST /dealer/scan-proxy`
Scan coupon on behalf of mason or for dealer's own wallet.

**Request (Proxy for Mason):**
```json
{
  "token": "COUPON_TOKEN",
  "mason_phone": "+919999999999",
  "cash_paid": true
}
```

**Request (Credit to Dealer):**
```json
{
  "token": "COUPON_TOKEN",
  "credit_to_dealer": true
}
```

**Features:**
- Atomic redemption using database transactions
- Credits mason if `mason_phone` provided
- Debits dealer if `cash_paid=true`
- Credits dealer if `credit_to_dealer=true`
- Prevents double-scanning with row-level locking

#### `GET /dealer/:id/wallet`
Get dealer balance and transaction history.

**Response:**
```json
{
  "balance": 500,
  "transactions": [
    {
      "id": "uuid",
      "type": "credit",
      "amount": 100,
      "note": "Scan for self",
      "created_at": "2025-11-23T..."
    }
  ]
}
```

#### `POST /dealer/:id/reimburse`
Request payout from dealer wallet.

**Request:**
```json
{
  "amount": 500
}
```

**Files Modified:**
- `packages/backend/src/routes/dealer.ts` (new)
- `packages/backend/src/routes/auth.ts`
- `packages/backend/src/middleware/auth.ts`
- `packages/backend/src/index.ts`

---

### 3. Backend Admin API for Dealers

**New Endpoints:**

#### `GET /admin/dealer-payouts`
List all dealer payout requests with dealer details.

**Response:**
```json
{
  "payouts": [
    {
      "id": "uuid",
      "dealer_id": "uuid",
      "dealer_name": "Test Dealer",
      "dealer_phone": "+919876543210",
      "dealer_gst": "GST123",
      "amount": 500,
      "status": "pending",
      "created_at": "2025-11-23T..."
    }
  ]
}
```

#### `POST /admin/dealer-payouts/:id/approve`
Approve a dealer payout request.

**Request:**
```json
{
  "reference": "TXN123456"
}
```

#### `GET /admin/dealer-payouts/export`
Export approved dealer payouts as CSV for accounting.

**Response:** CSV file with columns: id, amount, status, created_at, reference, name, phone, gst

**Files Modified:**
- `packages/backend/src/routes/admin.ts`

---

### 4. Dealer Frontend (Next.js)

**New Application:** `packages/dealer`

**Tech Stack:**
- Next.js 13.5.6 (Pages Router)
- React 18.2.0
- TypeScript
- Tailwind CSS
- axios (API client)
- react-hot-toast (notifications)
- lucide-react (icons)

**Pages:**

#### `pages/index.tsx` - Login
- Two-step OTP authentication
- Phone number input → OTP verification
- Validates dealer role before granting access
- Stores JWT in sessionStorage

#### `pages/scan.tsx` - Proxy Scanning
- Manual coupon token entry
- Two scanning modes:
  - **Proxy for Mason**: Enter mason phone, optionally mark cash paid
  - **Credit to Dealer**: Scan for own wallet
- Real-time feedback with toast notifications
- Navigation to wallet

#### `pages/wallet.tsx` - Wallet
- Displays current balance
- Shows recent transaction history
- Transaction type indicators (credit/debit)
- Link to request payout

#### `pages/reimburse.tsx` - Reimbursement
- Request payout form
- Validates amount against available balance
- Creates pending payout for admin approval
- Returns to wallet after submission

**Configuration:**
- `next.config.js` - Next.js configuration
- `tsconfig.json` - TypeScript with `moduleResolution: node`
- `tailwind.config.ts` - Tailwind CSS setup
- `utils/api.ts` - Axios client with JWT interceptor

**Port:** 3002 (to avoid conflicts with admin on 3001)

---

### 5. Testing

**Backend Integration Tests:**
- `packages/backend/tests/dealer.test.ts`
- 10 comprehensive tests covering:
  - Dealer registration
  - Dealer login with role='dealer'
  - Proxy scanning for mason (with cash paid)
  - Direct dealer credit scanning
  - Concurrency handling (6 parallel requests → 1 success, 5 conflicts)
  - Wallet balance calculation
  - Reimbursement requests
  - Admin dealer payout listing
  - Admin payout approval
  - CSV export

**Test Results:** ✅ All 10 tests passing

**Frontend Tests:**
- Basic test infrastructure with Jest and React Testing Library
- `__tests__/index.test.tsx` - Login page smoke test
- `jest.config.js` - Jest configuration
- `jest.setup.js` - Test setup

---

## How to Run

### Start Backend Services
```bash
cd c:/Project-Ali
docker compose up -d
```

### Start Dealer Frontend
```bash
cd c:/Project-Ali/packages/dealer
npm install
npm run dev
```

Access at: `http://localhost:3002`

### Run Backend Tests
```bash
docker compose exec backend npm test -- tests/dealer.test.ts --runInBand
```

---

## Testing the Dealer Flow

### 1. Login as Dealer

**Test Account:**
- Phone: `+919876543210`
- OTP: Use the database or insert known OTP `123456`

**Insert Test OTP:**
```bash
docker compose exec db psql -U postgres -d caceasy -c "DELETE FROM otps WHERE phone = '+919876543210';"

docker compose exec db psql -U postgres -d caceasy -c "INSERT INTO otps (phone, otp_hash, expires_at) VALUES ('+919876543210', '\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', NOW() + INTERVAL '5 minutes');"
```

### 2. Get Test Coupon Token

```bash
docker compose exec db psql -U postgres -d caceasy -c "SELECT token FROM coupons WHERE status = 'issued' LIMIT 1;"
```

### 3. Scan Coupon

**Option A: Proxy for Mason**
- Enter coupon token
- Enter mason phone: `+919999999999`
- Check "Cash Paid to Mason"
- Submit

**Option B: Credit to Dealer**
- Enter coupon token
- Check "Credit to My Wallet"
- Submit

### 4. Check Wallet

Navigate to Wallet page to see:
- Updated balance
- Transaction history

### 5. Request Reimbursement

- Click "Request Payout"
- Enter amount (≤ available balance)
- Submit

### 6. Admin Approves Payout

```bash
# List dealer payouts
curl http://localhost:3000/admin/dealer-payouts \
  -H "x-admin-key: your-secret-admin-key-here"

# Approve payout
curl -X POST http://localhost:3000/admin/dealer-payouts/PAYOUT_ID/approve \
  -H "Content-Type: application/json" \
  -H "x-admin-key: your-secret-admin-key-here" \
  -d '{"reference": "BANK_TXN_123"}'
```

---

## API Examples

### Register New Dealer
```bash
curl -X POST http://localhost:3000/dealer/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Dealer",
    "phone": "+919123456789",
    "gst": "GST29XYZ"
  }'
```

### Proxy Scan for Mason
```bash
curl -X POST http://localhost:3000/dealer/scan-proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer DEALER_JWT_TOKEN" \
  -d '{
    "token": "COUPON_TOKEN",
    "mason_phone": "+919999999999",
    "cash_paid": true
  }'
```

### Check Dealer Wallet
```bash
curl http://localhost:3000/dealer/DEALER_ID/wallet \
  -H "Authorization: Bearer DEALER_JWT_TOKEN"
```

### Request Reimbursement
```bash
curl -X POST http://localhost:3000/dealer/DEALER_ID/reimburse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer DEALER_JWT_TOKEN" \
  -d '{"amount": 500}'
```

### Admin: Export Dealer Payouts CSV
```bash
curl http://localhost:3000/admin/dealer-payouts/export \
  -H "x-admin-key: your-secret-admin-key-here" \
  -o dealer_payouts.csv
```

---

## Key Technical Decisions

### Atomic Operations
All coupon redemptions use database transactions with row-level locking (`FOR UPDATE`) to prevent race conditions and ensure data consistency.

### Role-Based Access Control
Extended JWT authentication to include `role` field, enabling dealers to access dealer-specific endpoints while maintaining separation from user endpoints.

### Balance Calculation
Dealer balance is calculated dynamically from `dealer_transactions` table:
```sql
SUM(credits) - SUM(debits + payouts + reimbursement_requests)
```

This includes pending reimbursement requests to prevent over-withdrawal.

### Frontend Type Compatibility
Fixed React 18/19 type incompatibility with `react-hot-toast` by casting `Toaster` component to `any`.

### Port Configuration
Dealer frontend runs on port 3002 to avoid conflicts:
- Backend: 3000
- Admin: 3001
- Dealer: 3002

---

## Acceptance Criteria

✅ **Database Schema**
- [x] `dealers` table created
- [x] `dealer_transactions` table created
- [x] `dealer_id` added to `transactions` and `scans`
- [x] `payouts` table updated with `type` and `dealer_id`
- [x] Sample dealer and payout data in seed.sql

✅ **Backend Dealer API**
- [x] `POST /dealer/register` implemented
- [x] `POST /auth/verify` supports dealer login with role='dealer'
- [x] `POST /dealer/scan-proxy` with atomic redemption
- [x] `GET /dealer/:id/wallet` returns balance and transactions
- [x] `POST /dealer/:id/reimburse` creates payout request

✅ **Backend Admin API**
- [x] `GET /admin/dealer-payouts` lists dealer payouts
- [x] `POST /admin/dealer-payouts/:id/approve` approves payouts
- [x] `GET /admin/dealer-payouts/export` exports CSV

✅ **Dealer Frontend**
- [x] Next.js app scaffolded in `packages/dealer`
- [x] Login page with OTP authentication
- [x] Scan page with manual/proxy modes
- [x] Wallet page with balance and history
- [x] Reimburse page with payout request form

✅ **Testing & Verification**
- [x] Backend integration tests (10/10 passing)
- [x] Concurrency tests for proxy scanning
- [x] CSV export tests
- [x] Frontend test infrastructure configured
- [x] Manual testing verified

---

## Module 4 Complete! ✅

All components are implemented, tested, and verified. The dealer functionality is ready for production deployment.
