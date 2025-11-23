# Module 1 - OpenAPI + Auth + Wallet Steps

This document tracks all the steps followed during Module 1 implementation for future reference and replication.

---

## Phase 1: Planning & Design

### Step 1: OpenAPI Specification
- **openapi.yaml**: Created a comprehensive API specification at the repo root.
  - Defined data schemas: `User`, `Batch`, `Coupon`, `Transaction`, `Wallet`, `OTPRequest`, `OTPVerify`.
  - Defined security schemes: `bearerAuth` (JWT) and `adminApiKey`.
  - Documented all endpoints:
    - Public: `/health`, `/version`, `/auth/otp`, `/auth/verify`
    - Protected (JWT): `/batches`, `/coupons/generate`, `/scan`, `/coupons/{token}`, `/users/{id}/wallet`, `/users/{id}/redeem`
    - Admin: `/admin/payouts`, `/admin/flagged`

### Step 2: Database Schema Updates
- **infra/seed/seed.sql**: Updated the initial schema.
  - Added `otps` table: Stores hashed OTPs with expiry (`phone`, `otp_hash`, `expires_at`, `verified`).
  - Updated `users` table: Added `phone` column (UNIQUE, NOT NULL).
  - Updated `batches` table: Added `name` and `sku` columns.
  - Added indexes for performance on `otps.phone` and `users.phone`.

---

## Phase 2: Core Infrastructure

### Step 3: Dependencies
- **packages/backend/package.json**: Added necessary libraries.
  - `jsonwebtoken`: For JWT generation and verification.
  - `bcryptjs`: For hashing OTPs.
  - `express-openapi-validator`: For request validation against spec.
  - `js-yaml`: For parsing OpenAPI spec in tests.
  - Added corresponding `@types` packages for TypeScript.

### Step 4: Configuration
- **packages/backend/src/config.ts**: Added environment variables.
  - `JWT_SECRET`: Secret key for signing tokens (default provided for dev, required for prod).
  - `ADMIN_API_KEY`: Static key for admin endpoints.

### Step 5: Authentication Middleware
- **packages/backend/src/middleware/auth.ts**: Created reusable middleware.
  - `authenticateJWT`: Verifies Bearer token, decodes user, and attaches to `req.user`.
  - `authenticateAdmin`: Checks `x-admin-key` header against configured key.

---

## Phase 3: API Implementation

### Step 6: Auth Routes
- **packages/backend/src/routes/auth.ts**:
  - `POST /auth/otp`: Generates 6-digit OTP, hashes it with bcrypt, stores in DB. (Logs OTP to console for dev).
  - `POST /auth/verify`: Validates OTP, checks expiry. If valid, finds/creates user by phone and issues JWT.

### Step 7: Protected Routes (Coupons & Scan)
- **packages/backend/src/routes/batches.ts**: `POST /batches` to create coupon batches.
- **packages/backend/src/routes/coupons.ts**:
  - `POST /coupons/generate`: Generates UUID tokens for a batch. Supports CSV export.
  - `GET /coupons/{token}`: Retrieves coupon status and details.
- **packages/backend/src/routes/scan.ts**:
  - Updated `POST /scan` to use `req.user.id` from JWT.
  - Maintained atomic transaction logic (`SELECT ... FOR UPDATE`) for concurrency safety.

### Step 8: Wallet & Admin Routes
- **packages/backend/src/routes/users.ts**:
  - `GET /users/{id}/wallet`: Calculates balance from transaction history.
  - `POST /users/{id}/redeem`: Creates payout request if balance suffices.
- **packages/backend/src/routes/admin.ts**:
  - `GET /admin/payouts`: Lists pending payouts.
  - `GET /admin/flagged`: Placeholder for fraud detection logic.

---

## Phase 4: Testing & Verification

### Step 9: Test Suite Updates
- **packages/backend/tests/api.test.ts**: Expanded comprehensive test suite.
  - **Self-Contained Setup**: `beforeAll` runs migrations (dropping tables first) and seeds data.
  - **Auth Flow**: Tests OTP request -> Verify -> JWT issuance.
  - **JWT Enforcement**: Verifies 401/403 for protected endpoints.
  - **Concurrency**: Validated 10 parallel scan requests result in exactly 1 success.
  - **Wallet**: Verified balance updates after redemption.

### Step 10: Docker Configuration Fixes
- **docker-compose.yml**:
  - Mounted `openapi.yaml` to `/app/openapi.yaml` in backend container so tests can read it.
  - Ensured `npm run start:dev` command for hot reloading.

### Step 11: Verification Results
- Ran tests using `docker compose run --rm backend npm test`.
- **Result**: All 20 tests passed.
- **Log Analysis**: Confirmed OTP generation logs and concurrency conflict logs (9 conflicts expected).

---

## Key Technical Decisions

### 1. Code-First OpenAPI
- **Decision**: Wrote `openapi.yaml` first, then implemented code.
- **Why**: Ensures API contract is clear and serves as documentation. Used `express-openapi-validator` (planned) and manual validation in tests.

### 2. OTP Authentication
- **Decision**: Phone number + OTP instead of Email + Password.
- **Why**: Low friction for mobile users.
- **Security**: OTPs are hashed (bcrypt) in DB, not stored plain text. 5-minute expiry.

### 3. JWT for Sessions
- **Decision**: Stateless JWTs.
- **Why**: Scalable, no server-side session storage needed.
- **Payload**: Contains `id` and `phone`.

### 4. Test Robustness
- **Decision**: Tests drop tables and re-run migrations on every run.
- **Why**: Prevents "relation already exists" or "column missing" errors when schema changes. Ensures tests run against the exact current schema.

---

## Troubleshooting Log (Replication Guide)

### Issue 1: "Relation users does not exist" / "Column phone does not exist"
- **Symptoms**: Tests failing with DB errors after schema updates.
- **Cause**: The test database container persisted the old schema volume.
- **Fix**: Updated `api.test.ts` to explicitly `DROP TABLE IF EXISTS ... CASCADE` before running migrations in `beforeAll`.

### Issue 2: "ENOENT: no such file or directory ... openapi.yaml"
- **Symptoms**: Tests failed to parse OpenAPI spec when running inside Docker.
- **Cause**: `openapi.yaml` is at the repo root but was not mounted into the backend container's `/app` directory.
- **Fix**: Added volume mount `- ./openapi.yaml:/app/openapi.yaml` to `docker-compose.yml`.

### Issue 3: "YAML Exception" in Docker Compose
- **Symptoms**: `docker compose up` failed.
- **Cause**: Duplicate keys in `docker-compose.yml` (copy-paste error).
- **Fix**: Cleaned up the YAML file to have valid structure.

---

## Commands Reference

### Running Tests (Recommended)
```bash
docker compose run --rm backend npm test
```

### Viewing Test Logs (if truncated)
```bash
docker compose run --rm backend sh -c "npm test > test_output.txt 2>&1"
```

### Manual API Testing (Auth Flow)
```bash
# 1. Request OTP
curl -X POST http://localhost:3000/auth/otp -H "Content-Type: application/json" -d '{"phone": "+15550001234"}'

# 2. Verify OTP (Get OTP from backend logs: docker compose logs backend)
curl -X POST http://localhost:3000/auth/verify -H "Content-Type: application/json" -d '{"phone": "+15550001234", "otp": "123456"}'

# 3. Use Token
curl http://localhost:3000/batches -H "Authorization: Bearer <TOKEN>" ...
```
