# CACeasy - Coupon & Commission Management System

A comprehensive monorepo application for managing coupon distribution, scanning, wallet management, and payout automation for masons, dealers, and administrators.

## 📋 Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Modules](#modules)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

**CACeasy** is a full-stack application designed to streamline coupon-based commission systems for construction workers (masons), dealers, and administrators. The system enables:

- **Coupon Generation & Distribution**: Admins create batches of coupons with point values
- **Mobile Scanning**: Masons scan QR codes to redeem points
- **Dealer Proxy Scanning**: Dealers scan on behalf of masons and manage cash payouts
- **Wallet Management**: Track points and request payouts
- **Admin Dashboard**: Monitor analytics, approve payouts, and manage fraud detection
- **Offline-First Mobile**: Queue scans when offline and sync when connected

---

## 🏗️ System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Mobile App     │     │  Admin Dashboard│     │  Dealer Portal  │
│  (Expo/RN)      │     │  (Next.js)      │     │  (Next.js)      │
│  Port: Expo     │     │  Port: 3001     │     │  Port: 3002     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Backend API           │
                    │   (Express + TypeScript)│
                    │   Port: 3000            │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   PostgreSQL Database   │
                    │   Port: 5432            │
                    └─────────────────────────┘
                    ┌─────────────────────────┐
                    │   Redis Cache           │
                    │   Port: 6379            │
                    └─────────────────────────┘
```

---

## 📦 Modules

### Module 0: Core Infrastructure
**Status**: ✅ Complete

- Monorepo setup with npm workspaces
- Docker Compose orchestration (Postgres, Redis, Backend, Admin)
- Database schema with UUID primary keys
- Express backend with TypeScript
- Concurrency-safe coupon redemption using row-level locking
- CI/CD with GitHub Actions

**Key Features**:
- Health check endpoints
- Coupon generation (JSON/CSV export)
- Atomic scan redemption with `SELECT ... FOR UPDATE`
- Transaction ledger for points tracking

---

### Module 1: Authentication & Wallet
**Status**: ✅ Complete

- Phone-based OTP authentication (bcrypt hashed)
- JWT session management (stateless tokens)
- OpenAPI specification (`openapi.yaml`)
- Protected API endpoints with Bearer token auth
- User wallet with balance calculation
- Payout request system

**Key Features**:
- `POST /auth/otp` - Request OTP
- `POST /auth/verify` - Verify OTP and issue JWT
- `GET /users/{id}/wallet` - Get wallet balance
- `POST /users/{id}/redeem` - Request payout
- Admin API key authentication

---

### Module 2: Mason Mobile App
**Status**: ✅ Complete (8/8 tests passing)

- Expo React Native application
- QR code scanning with `expo-camera`
- GPS location capture with `expo-location`
- Offline-first queue with AsyncStorage
- Audio/TTS feedback for scan results
- Transaction history

**Key Features**:
- Two-step OTP login flow
- Real-time wallet balance display
- Offline scan queueing with auto-sync
- Manual coupon entry fallback
- Settings (language, sound, clear data)

**Tech Stack**: Expo 48, React Native 0.71, React Navigation, Axios, React Native Paper

---

### Module 3: Admin Dashboard
**Status**: ✅ Complete (20/20 tests passing)

- Next.js admin portal with Tailwind CSS
- API key authentication with rate limiting (20 req/min)
- Comprehensive analytics dashboard
- Payout approval workflow
- Fraud detection queue
- Audit logging (JSONB payload storage)

**Key Features**:
- KPI tiles (scans/day, active masons, redemption rate)
- Flagged events management with resolution workflow
- Bulk payout approval with CSV export
- Batch management with coupon generation
- Admin audit trail

**Tech Stack**: Next.js 13.4, TypeScript, Tailwind CSS, Axios, date-fns, lucide-react

---

### Module 4: Dealer Portal & Proxy Scanning
**Status**: ✅ Complete (10/10 tests passing)

- Dealer registration with GST tracking
- Proxy scanning on behalf of masons
- Dealer wallet with credit/debit tracking
- Reimbursement request system
- Admin dealer payout management

**Key Features**:
- `POST /dealer/register` - Register new dealer
- `POST /dealer/scan-proxy` - Scan for mason or self
- `GET /dealer/{id}/wallet` - Dealer balance and transactions
- `POST /dealer/{id}/reimburse` - Request reimbursement
- `GET /admin/dealer-payouts` - Admin payout management
- CSV export for accounting

**Tech Stack**: Next.js 13.5, TypeScript, Tailwind CSS, Axios, react-hot-toast

---

## 🔧 Prerequisites

- **Docker** (v20+) & **Docker Compose** (v2+)
- **Node.js** (v18+) - for local development
- **npm** (v9+)
- **Git**

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/MohammadAli-dev/caceasy.git
cd caceasy
```

### 2. Install Dependencies

```bash
npm install
```

This will install dependencies for all packages in the monorepo.

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@db:5432/caceasy

# Redis
REDIS_URL=redis://redis:6379

# Authentication
JWT_SECRET=your-secret-jwt-key-change-in-production
ADMIN_API_KEY=your-secret-admin-key-here

# Backend
PORT=3000
NODE_ENV=development
```

### 4. Start Services with Docker Compose

```bash
docker compose up --build
```

This will start:
- **PostgreSQL** (port 5432)
- **Redis** (port 6379)
- **Backend API** (port 3000)
- **Admin Dashboard** (port 3001)

### 5. Initialize Database

In a separate terminal:

```bash
# Run migrations
docker compose exec backend npm run migrate

# Seed sample data
docker compose exec backend npm run seed
```

### 6. Access Applications

- **Backend API**: http://localhost:3000
- **Admin Dashboard**: http://localhost:3001
- **Dealer Portal**: http://localhost:3002 (requires separate `npm run dev`)

### 7. Start Mobile App (Optional)

```bash
cd packages/mobile
npm install
npm start
```

Follow Expo CLI instructions to run on Android/iOS emulator or physical device.

### 8. Start Dealer Portal (Optional)

```bash
cd packages/dealer
npm install
npm run dev
```

Access at http://localhost:3002

---

## 📁 Project Structure

```
caceasy/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI/CD
├── infra/
│   └── seed/
│       ├── seed.sql               # Database schema & seed data
│       └── seed.sh                # Migration script
├── packages/
│   ├── backend/                   # Express + TypeScript API
│   │   ├── src/
│   │   │   ├── config.ts          # Environment configuration
│   │   │   ├── db.ts              # PostgreSQL connection pool
│   │   │   ├── index.ts           # Express app entry point
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts        # JWT & Admin auth middleware
│   │   │   ├── routes/
│   │   │   │   ├── health.ts      # Health check endpoints
│   │   │   │   ├── auth.ts        # OTP authentication
│   │   │   │   ├── coupons.ts     # Coupon generation
│   │   │   │   ├── scan.ts        # Coupon scanning
│   │   │   │   ├── users.ts       # User wallet & redemption
│   │   │   │   ├── admin.ts       # Admin dashboard API
│   │   │   │   └── dealer.ts      # Dealer proxy scanning
│   │   │   └── scripts/
│   │   │       ├── migrate.ts     # Database migration
│   │   │       └── seed.ts        # Seed sample data
│   │   ├── tests/
│   │   │   ├── api.test.ts        # Core API tests
│   │   │   ├── admin.test.ts      # Admin API tests
│   │   │   └── dealer.test.ts     # Dealer API tests
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   ├── admin/                     # Next.js Admin Dashboard
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   └── api.ts         # API client
│   │   │   ├── pages/
│   │   │   │   ├── index.tsx      # Dashboard
│   │   │   │   ├── login.tsx      # Admin login
│   │   │   │   ├── payouts.tsx    # Payout management
│   │   │   │   ├── flagged.tsx    # Fraud detection
│   │   │   │   └── batches.tsx    # Batch management
│   │   │   └── styles/
│   │   │       └── globals.css    # Tailwind styles
│   │   ├── package.json
│   │   └── tailwind.config.js
│   ├── mobile/                    # Expo React Native App
│   │   ├── src/
│   │   │   ├── config.ts          # App configuration
│   │   │   ├── services/
│   │   │   │   └── api.ts         # API client with JWT
│   │   │   ├── context/
│   │   │   │   └── AuthContext.tsx # Auth state management
│   │   │   ├── utils/
│   │   │   │   └── offlineQueue.ts # Offline sync queue
│   │   │   ├── screens/
│   │   │   │   ├── LoginScreen.tsx
│   │   │   │   ├── HomeScreen.tsx
│   │   │   │   ├── ScannerScreen.tsx
│   │   │   │   ├── WalletScreen.tsx
│   │   │   │   ├── HistoryScreen.tsx
│   │   │   │   └── SettingsScreen.tsx
│   │   │   └── __tests__/
│   │   │       ├── App.test.tsx
│   │   │       └── OfflineQueue.test.ts
│   │   ├── App.tsx
│   │   ├── package.json
│   │   └── app.json
│   └── dealer/                    # Next.js Dealer Portal
│       ├── pages/
│       │   ├── index.tsx          # Login
│       │   ├── scan.tsx           # Proxy scanning
│       │   ├── wallet.tsx         # Dealer wallet
│       │   └── reimburse.tsx      # Reimbursement request
│       ├── utils/
│       │   └── api.ts             # API client
│       ├── package.json
│       └── tailwind.config.ts
├── openapi.yaml                   # OpenAPI 3.0 specification
├── docker-compose.yml             # Docker orchestration
├── package.json                   # Root workspace config
└── README.md                      # This file
```

---

## 📡 API Documentation

### Authentication Endpoints

#### Request OTP
```bash
POST /auth/otp
Content-Type: application/json

{
  "phone": "+919999999999"
}
```

**Response**: `{ "message": "OTP sent" }`

#### Verify OTP & Get JWT
```bash
POST /auth/verify
Content-Type: application/json

{
  "phone": "+919999999999",
  "otp": "123456"
}
```

**Response**: `{ "token": "eyJhbGc...", "user": {...} }`

---

### Coupon Endpoints (Protected)

#### Generate Coupons
```bash
POST /coupons/generate
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "batch_id": "uuid",
  "quantity": 100,
  "points": 50
}
```

**Response**: JSON array of coupon objects or CSV (based on `Accept` header)

#### Scan Coupon
```bash
POST /scan
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "token": "coupon-uuid-token",
  "user_id": "user-uuid",
  "device_id": "device-123",
  "gps": {
    "lat": 12.9716,
    "long": 77.5946
  }
}
```

**Response**: `{ "success": true, "points": 50, "new_balance": 150 }`

---

### Wallet Endpoints (Protected)

#### Get Wallet Balance
```bash
GET /users/{user_id}/wallet
Authorization: Bearer <JWT_TOKEN>
```

**Response**: `{ "balance": 500, "transactions": [...] }`

#### Request Payout
```bash
POST /users/{user_id}/redeem
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "amount": 500
}
```

**Response**: `{ "payout_id": "uuid", "status": "pending" }`

---

### Dealer Endpoints (Protected, Role: dealer)

#### Register Dealer
```bash
POST /dealer/register
Content-Type: application/json

{
  "name": "Dealer Name",
  "phone": "+919876543210",
  "gst": "GST29ABCDE1234F1Z5"
}
```

#### Proxy Scan for Mason
```bash
POST /dealer/scan-proxy
Authorization: Bearer <DEALER_JWT>
Content-Type: application/json

{
  "token": "coupon-uuid",
  "mason_phone": "+919999999999",
  "cash_paid": true
}
```

#### Get Dealer Wallet
```bash
GET /dealer/{dealer_id}/wallet
Authorization: Bearer <DEALER_JWT>
```

#### Request Reimbursement
```bash
POST /dealer/{dealer_id}/reimburse
Authorization: Bearer <DEALER_JWT>
Content-Type: application/json

{
  "amount": 500
}
```

---

### Admin Endpoints (Protected, x-admin-key header)

#### Get Analytics
```bash
GET /admin/analytics
x-admin-key: your-secret-admin-key
```

**Response**:
```json
{
  "scans_per_day": 125,
  "active_masons": 15,
  "redemption_rate": 0.85,
  "pending_payouts_count": 3,
  "top_regions": [{"region": "Bangalore", "count": 50}]
}
```

#### List Payouts
```bash
GET /admin/payouts?status=pending
x-admin-key: your-secret-admin-key
```

#### Approve Payout
```bash
POST /admin/payouts/{payout_id}/approve
x-admin-key: your-secret-admin-key
Content-Type: application/json

{
  "reference": "TXN123456"
}
```

#### List Flagged Events
```bash
GET /admin/flagged?status=open
x-admin-key: your-secret-admin-key
```

#### Resolve Flagged Event
```bash
POST /admin/flagged/{event_id}/resolve
x-admin-key: your-secret-admin-key
Content-Type: application/json

{
  "action": "verified_legitimate",
  "notes": "Verified with user"
}
```

#### Export Dealer Payouts CSV
```bash
GET /admin/dealer-payouts/export
x-admin-key: your-secret-admin-key
```

---

## 🧪 Testing

### Run All Tests

```bash
# Backend tests (all modules)
docker compose run --rm backend npm test

# Specific test suite
docker compose run --rm backend npm test -- tests/api.test.ts
docker compose run --rm backend npm test -- tests/admin.test.ts
docker compose run --rm backend npm test -- tests/dealer.test.ts

# Mobile app tests
cd packages/mobile
npm test

# Admin dashboard tests
cd packages/admin
npm test

# Dealer portal tests
cd packages/dealer
npm test
```

### Test Coverage

- **Backend**: 50+ tests covering all endpoints, concurrency, auth, and edge cases
- **Mobile**: 8 tests covering offline queue, auth flow, and navigation
- **Admin**: Test infrastructure configured
- **Dealer**: Test infrastructure configured

### Concurrency Test

The backend includes a critical concurrency test that fires 10 parallel scan requests for the same coupon token. Expected result:
- ✅ Exactly 1 success (HTTP 200)
- ✅ Exactly 9 conflicts (HTTP 409)

This validates the row-level locking mechanism prevents double-redemption.

---

## 🚢 Deployment

### Production Checklist

#### Environment Variables
```bash
# Set strong secrets
JWT_SECRET=<strong-random-secret>
ADMIN_API_KEY=<strong-random-secret>

# Database
DATABASE_URL=postgresql://user:pass@host:5432/caceasy

# Redis
REDIS_URL=redis://host:6379

# Node environment
NODE_ENV=production
```

#### Security
- [ ] Enable HTTPS for all services
- [ ] Configure CORS to whitelist specific origins
- [ ] Set up IP whitelist for admin endpoints
- [ ] Enable rate limiting on all public endpoints
- [ ] Rotate JWT secrets periodically
- [ ] Use strong ADMIN_API_KEY (min 32 characters)

#### Database
- [ ] Set up automated backups
- [ ] Enable connection pooling
- [ ] Configure read replicas for scaling
- [ ] Monitor slow queries
- [ ] Set up audit log archival

#### Monitoring
- [ ] Set up application logging (Winston, Pino)
- [ ] Configure error tracking (Sentry)
- [ ] Set up uptime monitoring
- [ ] Configure alerts for failed payouts
- [ ] Monitor Redis memory usage

#### CI/CD
GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push:
- Linting (ESLint)
- Type checking (TypeScript)
- Unit tests (Jest)
- Integration tests

---

## 🐛 Troubleshooting

### Database Connection Issues

**Problem**: `ECONNREFUSED` or `relation does not exist`

**Solution**:
```bash
# Restart services
docker compose down -v
docker compose up --build

# Re-run migrations
docker compose exec backend npm run migrate
docker compose exec backend npm run seed
```

---

### Mobile App Can't Connect to Backend

**Problem**: Network request failed

**Solution**:
- **Android Emulator**: Use `http://10.0.2.2:3000` (not `localhost`)
- **iOS Simulator**: Use `http://localhost:3000`
- **Physical Device**: Use your computer's local IP (e.g., `http://192.168.1.100:3000`)

Update `packages/mobile/src/config.ts`:
```typescript
export const CONFIG = {
  API_URL: 'http://10.0.2.2:3000', // Change based on your setup
};
```

---

### Tests Failing with "Relation Already Exists"

**Problem**: Database schema conflicts

**Solution**: Tests now automatically drop and recreate tables. If issues persist:
```bash
# Clear database volume
docker compose down -v
docker compose up -d db
docker compose exec backend npm test
```

---

### Admin Dashboard 401 Unauthorized

**Problem**: Invalid API key

**Solution**:
1. Check `.env` file has `ADMIN_API_KEY` set
2. Restart backend: `docker compose restart backend`
3. Use the same key in admin login page
4. Check browser sessionStorage: `sessionStorage.getItem('adminApiKey')`

---

### Rate Limiting Blocking Requests

**Problem**: `429 Too Many Requests`

**Solution**: Rate limits reset on backend restart or wait 1 minute. For development:
```typescript
// packages/backend/src/routes/admin.ts
// Temporarily increase limit
const RATE_LIMIT = 100; // Default: 20
```

---

## 📚 Additional Resources

- **OpenAPI Specification**: See `openapi.yaml` for complete API documentation
- **Module Documentation**:
  - `MODULE_0_STEPS.md` - Core infrastructure setup
  - `MODULE_1_STEPS.md` - Authentication & wallet
  - `MODULE_2_STEPS.md` - Mobile app implementation
  - `MODULE_3_STEPS.md` - Admin dashboard
  - `MODULE_4_STEPS.md` - Dealer portal
- **Admin Dashboard README**: `packages/admin/README.md`
- **Dealer Portal README**: `packages/dealer/README.md`

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 👥 Support

For issues, questions, or feature requests, please contact the development team or create an issue in the GitHub repository.

---

**Built with ❤️ using TypeScript, React, Next.js, Expo, Express, and PostgreSQL**
