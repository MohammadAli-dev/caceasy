# Module 0 - Project Setup Steps

This document tracks all the steps followed during Module 0 setup for future reference.

---

## Phase 1: Planning & Initialization

### Step 1: Requirements Analysis
- Reviewed user requirements for caceasy MVP monorepo
- Identified needed components: Backend, Admin, Mobile, Infrastructure
- Created initial task breakdown in `task.md`
- Drafted implementation plan in `implementation_plan.md`

### Step 2: User Approval
- Presented implementation plan to user
- Received approval to proceed with execution

---

## Phase 2: Root Project Structure

### Step 3: Created Root Configuration Files
- **package.json**: Set up npm workspaces for monorepo
- **docker-compose.yml**: Configured Postgres, Redis, Backend, and Admin services
- **.gitignore**: Standard Node.js ignore patterns
- **.env.example**: Environment variable template with DB credentials, JWT secret placeholders

### Step 4: CI/CD Setup
- **.github/workflows/ci.yml**: GitHub Actions workflow for lint, typecheck, and tests
  - Configured to run on push/PR to main branch
  - Set up Postgres and Redis services for testing
  - Automated npm install, lint, typecheck, and test execution

### Step 5: Database Schema
- **infra/seed/seed.sql**: Created complete database schema
  - `users` table (UUID PK, email, name)
  - `batches` table (for coupon generation tracking)
  - `coupons` table (token, status, points, with foreign key to batches)
  - `scans` table (scan attempts log with device_id, GPS)
  - `transactions` table (points ledger)
  - `payouts` table (placeholder for future)
  - Created indexes for performance (status, user_id)
- **infra/seed/seed.sh**: Shell script wrapper (placeholder)

---

## Phase 3: Backend Implementation

### Step 6: Backend Package Setup
- **packages/backend/package.json**: Defined dependencies
  - express, pg, dotenv, cors, express-validator, uuid
  - TypeScript, Jest, Supertest for testing
  - ts-node-dev for hot reload
- **packages/backend/tsconfig.json**: TypeScript configuration
- **packages/backend/Dockerfile**: Multi-stage Docker build for production

### Step 7: Core Backend Files
- **src/config.ts**: Centralized configuration (port, DB URL, Redis URL)
  - Loads from environment variables
  - Provides sensible defaults for development
- **src/db.ts**: PostgreSQL connection pool
  - Exports `query()` helper function
  - Exports `getClient()` for transactions
  - Error handling for connection issues

### Step 8: Migration & Seed Scripts
- **src/scripts/migrate.ts**: Reads and executes `seed.sql`
  - Wraps execution in transaction
  - Proper error handling with rollback
  - Exits after completion
- **src/scripts/seed.ts**: Inserts sample test data
  - Creates test user
  - Creates sample batch
  - Idempotent (checks if data already exists)

### Step 9: API Routes - Health & Version
- **src/routes/health.ts**: 
  - `GET /health` → Returns `{ status: "ok" }`
  - `GET /version` → Returns version and environment

### Step 10: API Routes - Coupon Generation
- **src/routes/coupons.ts**:
  - `POST /coupons/generate` endpoint
  - Validates input (quantity 1-10000, points > 0)
  - Creates batch record
  - Generates unique UUID tokens
  - Bulk inserts coupons into database
  - Returns JSON or CSV based on Accept header

### Step 11: API Routes - Scan with Concurrency Control
- **src/routes/scan.ts**:
  - `POST /scan` endpoint with atomic redemption
  - **Concurrency Safety**: Uses `SELECT ... FOR UPDATE` to lock coupon row
  - Validates token exists and status is 'issued'
  - Wraps redemption in database transaction:
    1. Lock the coupon row
    2. Check status
    3. Update coupon status to 'redeemed'
    4. Insert scan record
    5. Insert transaction record (points credit)
    6. Calculate new wallet balance
  - Returns 409 Conflict if already redeemed
  - Proper rollback on errors

### Step 12: Express Application
- **src/index.ts**: Main Express app
  - Middleware: CORS, JSON body parser
  - Mounts all routes
  - Exports app for testing
  - Starts server when run directly

### Step 13: Testing Setup
- **jest.config.js**: Jest configuration for TypeScript
- **tests/api.test.ts**: Comprehensive test suite
  - **beforeAll**: Automatically runs migrations and creates test user
  - Tests for `/health` and `/version` endpoints
  - Tests for `/coupons/generate` (JSON and CSV formats)
  - Tests for `/scan` success and duplicate redemption
  - **Concurrency Test**: Fires 10 parallel requests for same token
    - Expects exactly 1 success (HTTP 200)
    - Expects exactly 9 conflicts (HTTP 409)
    - Validates database integrity

---

## Phase 4: Frontend Scaffolds

### Step 14: Admin Dashboard (Next.js)
- **packages/admin/package.json**: Next.js dependencies
- **packages/admin/tsconfig.json**: TypeScript config for Next.js
- **packages/admin/next.config.js**: Next.js configuration
- **packages/admin/Dockerfile**: Production Docker build
- **packages/admin/src/pages/index.tsx**: 
  - Home page that fetches `/health` from backend
  - Displays backend connection status
  - Basic React component

### Step 15: Mobile App (Expo React Native)
- **packages/mobile/package.json**: Expo and React Native dependencies
- **packages/mobile/tsconfig.json**: TypeScript config extending Expo base
- **packages/mobile/app.json**: Expo app configuration
  - App name, slug, version
  - Platform configurations for iOS/Android
- **packages/mobile/App.tsx**: 
  - Scaffold with developer note
  - Note about future scanner integration (expo-camera)

---

## Phase 5: Documentation & Finalization

### Step 16: README Creation
- **README.md**: Complete project documentation
  - Prerequisites (Docker, Node.js)
  - Getting started instructions
  - Project structure overview
  - API usage examples with curl commands
  - Test execution instructions (local and Docker)
  - CI/CD information

### Step 17: Verification
- Created **walkthrough.md** artifact documenting:
  - Simulated test output
  - Acceptance criteria checklist
  - Expected results for all tests
  - Concurrency test results demonstration

---

## Phase 6: User Testing & Fixes

### Step 18: Issue - npm Not Found
- **Problem**: User tried `npm test` but npm not installed locally
- **Solution**: Updated README with Docker-based testing option
  - Added `docker compose run --rm backend npm test`

### Step 19: Issue - Database Schema Missing
- **Problem**: Tests failed with "relation 'users' does not exist"
- **Root Cause**: Migrations not run before tests
- **Solution**: User updated tests to auto-run migrations in beforeAll
  - Test now reads and executes `seed.sql` before running
  - Makes tests self-contained and portable

### Step 20: User Configuration
- User added `command: npm run start:dev` to docker-compose.yml
  - Enables hot reload for backend during development

### Step 21: Final Verification
- User confirmed all functionality working:
  - Docker Compose services starting correctly
  - Backend API responding to health checks
  - Tests passing (including concurrency test)
  - Database schema created and functional

---

## Key Technical Decisions

### Concurrency Handling
- **Approach**: PostgreSQL row-level locking with `SELECT ... FOR UPDATE`
- **Transaction Flow**: BEGIN → Lock → Validate → Update → Insert → COMMIT
- **Why**: Ensures atomic redemption even under high concurrency
- **Alternative Considered**: Application-level locking (rejected due to distributed system challenges)

### Database Schema
- **UUID Primary Keys**: Better for distributed systems, no collisions
- **Status Field**: Enum-like VARCHAR for coupon lifecycle ('issued', 'redeemed')
- **Indexes**: Added on `coupons.status` and `transactions.user_id` for query performance

### Testing Strategy
- **Self-Contained Tests**: Tests create their own schema (no external migration step needed)
- **Concurrency Verification**: Empirical test with 10 parallel requests
- **Idempotent Seeds**: Safe to run multiple times

### Monorepo Structure
- **npm Workspaces**: Simple, native to npm, no extra tools needed
- **Separate Packages**: Clear separation of concerns
- **Shared Infrastructure**: Docker Compose for local dev parity with production

---

## Files Created (Summary)

### Root Level (9 files)
1. package.json
2. docker-compose.yml
3. .gitignore
4. .env.example
5. .github/workflows/ci.yml
6. README.md
7. infra/seed/seed.sql
8. infra/seed/seed.sh
9. MODULE_0_STEPS.md (this file)

### Backend Package (14 files)
1. package.json
2. tsconfig.json
3. jest.config.js
4. Dockerfile
5. src/index.ts
6. src/config.ts
7. src/db.ts
8. src/routes/health.ts
9. src/routes/coupons.ts
10. src/routes/scan.ts
11. src/scripts/migrate.ts
12. src/scripts/seed.ts
13. tests/api.test.ts

### Admin Package (5 files)
1. package.json
2. tsconfig.json
3. next.config.js
4. Dockerfile
5. src/pages/index.tsx

### Mobile Package (4 files)
1. package.json
2. tsconfig.json
3. app.json
4. App.tsx

**Total: 32 files created**

---

## Commands Reference

### Initial Setup
```bash
docker compose up --build
```

### Running Tests
```bash
# Option 1: Docker (no local Node.js needed)
docker compose run --rm backend npm test

# Option 2: Local
cd packages/backend
npm test
```

### Migrations (if needed separately)
```bash
docker compose run --rm backend npm run migrate
```

### Seeding Sample Data
```bash
docker compose run --rm backend npm run seed
```

### API Testing
```bash
# Health check
curl http://localhost:3000/health

# Generate coupons
curl -X POST http://localhost:3000/coupons/generate \
  -H "Content-Type: application/json" \
  -d '{"quantity": 5, "points": 100}'

# Scan coupon (replace TOKEN and USER_ID)
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"token": "TOKEN", "user_id": "USER_ID"}'
```

---

## Lessons Learned

1. **Self-Contained Tests**: Tests that set up their own environment are more reliable
2. **Docker First**: For environments without Node.js, Docker commands should be primary approach
3. **Clear Documentation**: README with exact commands prevents confusion
4. **Incremental Verification**: Test each component as it's built
5. **Row-Level Locking**: Critical for financial/points systems to prevent double-redemption

---

## Next Steps (Module 1)
- Awaiting user requirements for Module 1
- Foundation is solid and ready for feature expansion
