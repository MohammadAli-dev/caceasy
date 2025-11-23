# Clean Build Guide - Starting from Scratch

## ✅ Yes, You Can Build from Scratch!

The project is fully containerized and can be built from a clean slate. All dependencies, database schemas, and configurations are properly defined.

## 🧹 Step 1: Clean Docker Environment

### Option A: Clean Everything (Nuclear Option)
```bash
# Stop all running containers
docker stop $(docker ps -aq)

# Remove all containers
docker rm $(docker ps -aq)

# Remove all images
docker rmi $(docker images -q) -f

# Remove all volumes (WARNING: This deletes all data!)
docker volume rm $(docker volume ls -q)

# Remove all networks
docker network prune -f

# Clean build cache
docker builder prune -a -f
```

### Option B: Clean Only This Project
```bash
# From project root
cd C:\caceasy

# Stop and remove containers for this project
docker compose down -v

# Remove project-specific images
docker rmi caceasy-backend caceasy-admin postgres:13 redis:7 -f

# Remove project volume
docker volume rm caceasy_postgres_data
```

## 🚀 Step 2: Build from Scratch

### Method 1: Using Docker Compose (Recommended)

```bash
# From project root
cd C:\caceasy

# Build and start all services
docker compose up --build -d

# Wait for services to be ready (about 30 seconds)
timeout /t 30

# Check status
docker compose ps

# View logs
docker compose logs -f
```

**What happens:**
1. ✅ Postgres container starts and runs `infra/seed/seed.sql` automatically
2. ✅ Redis container starts
3. ✅ Backend builds from Dockerfile, installs dependencies, compiles TypeScript
4. ✅ Admin frontend builds with Next.js
5. ✅ All services connect and start

### Method 2: Step-by-Step Build

```bash
cd C:\caceasy

# 1. Start database first
docker compose up -d postgres
timeout /t 10

# 2. Verify database is ready
docker compose exec postgres psql -U postgres -d caceasy -c "\dt"

# 3. Start Redis
docker compose up -d redis

# 4. Build and start backend
docker compose up --build -d backend

# 5. Build and start admin
docker compose up --build -d admin

# 6. Check all services
docker compose ps
```

## 📊 Step 3: Initialize Analytics (Module 5)

```bash
# Compute initial analytics data
docker compose exec backend npm run compute:analytics -- --days=7
```

Expected output:
```
Computing analytics for the last 7 days...
Date range: 2023-11-17 to 2023-11-23
Processing 2023-11-17...
  ✓ Scans: 120, Active Masons: 45, Redemptions: 95, Rate: 79.17%
...
✅ Successfully computed analytics for 7 days.
```

## ✅ Step 4: Verify Everything Works

### Check Services
```bash
# All services should be running
docker compose ps

# Expected output:
# NAME                  STATUS    PORTS
# caceasy-postgres-1    Up        0.0.0.0:5432->5432/tcp
# caceasy-redis-1       Up        0.0.0.0:6379->6379/tcp
# caceasy-backend-1     Up        0.0.0.0:3000->3000/tcp
# caceasy-admin-1       Up        0.0.0.0:3001->3000/tcp
```

### Check Database
```bash
# Connect to database
docker compose exec postgres psql -U postgres -d caceasy

# List tables (should see all Module 0-5 tables)
\dt

# Check analytics_daily table
SELECT COUNT(*) FROM analytics_daily;
# Should return 7 (from seed data)

# Exit
\q
```

### Test Backend API
```bash
# Health check
curl http://localhost:3000/health

# Analytics overview (requires admin key)
curl -H "x-admin-api-key: test-admin-key-12345" http://localhost:3000/admin/analytics/overview
```

### Test Admin UI
Open browser and navigate to:
- **Admin Dashboard**: http://localhost:3001
- **Login**: Use API key `test-admin-key-12345`
- **Analytics Page**: http://localhost:3001/analytics

## 🧪 Step 5: Run Tests

### Backend Tests
```bash
# Run all backend tests
docker compose exec backend npm test

# Run only analytics tests
docker compose exec backend npm test -- tests/analytics.test.ts --runInBand
```

### Frontend Tests (Local)
```bash
# Frontend tests need to run locally (not in Docker)
cd packages\admin
npm install
npm test
```

## 🔧 Alternative: Local Development (Without Docker)

If you prefer to run services locally:

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis 7+

### Setup
```bash
# 1. Start PostgreSQL locally
# Create database: caceasy
# Run: infra/seed/seed.sql

# 2. Start Redis locally
redis-server

# 3. Backend
cd packages\backend
npm install
npm run build
npm run start:dev

# 4. Admin (in new terminal)
cd packages\admin
npm install
npm run dev

# 5. Compute analytics
cd packages\backend
npm run compute:analytics -- --days=7
```

## 📋 What Gets Created on Fresh Build

### Docker Containers
1. **caceasy-postgres-1**: PostgreSQL database
2. **caceasy-redis-1**: Redis cache
3. **caceasy-backend-1**: Node.js backend API
4. **caceasy-admin-1**: Next.js admin frontend

### Docker Volumes
1. **caceasy_postgres_data**: Persistent database storage

### Docker Networks
1. **caceasy_default**: Internal network for services

### Database Tables (Auto-created from seed.sql)
1. `users` - User accounts
2. `otps` - OTP authentication
3. `batches` - Coupon batches
4. `coupons` - Individual coupons
5. `scans` - Scan logs
6. `transactions` - Points ledger
7. `payouts` - Payout requests
8. `flagged_events` - Fraud detection
9. `admin_audit` - Admin action logs
10. `dealers` - Dealer accounts (Module 4)
11. `dealer_transactions` - Dealer ledger (Module 4)
12. `analytics_daily` - Analytics aggregations (Module 5)

### Sample Data (Auto-seeded)
- 1 sample dealer
- 1 sample dealer payout
- 7 days of analytics data

## 🐛 Troubleshooting Clean Build

### Issue: Port Already in Use
```bash
# Find process using port 5432
netstat -ano | findstr :5432

# Kill process
taskkill /PID <PID> /F

# Or change port in docker-compose.yml
```

### Issue: Build Fails - Out of Disk Space
```bash
# Clean Docker system
docker system prune -a --volumes -f

# This frees up space from old images/containers
```

### Issue: Database Not Initializing
```bash
# Check logs
docker compose logs postgres

# Manually run seed script
docker compose exec postgres psql -U postgres -d caceasy -f /docker-entrypoint-initdb.d/seed.sql
```

### Issue: Backend Build Fails
```bash
# Check logs
docker compose logs backend

# Common fix: Clear node_modules and rebuild
docker compose down
docker compose up --build --force-recreate backend
```

### Issue: Admin Build Fails
```bash
# Check logs
docker compose logs admin

# The admin Dockerfile expects standalone build
# Verify next.config.js has: output: 'standalone'
```

## 📝 Build Time Expectations

| Service | First Build | Subsequent Builds |
|---------|-------------|-------------------|
| Postgres | ~10 seconds | ~5 seconds |
| Redis | ~5 seconds | ~2 seconds |
| Backend | ~2-3 minutes | ~30 seconds |
| Admin | ~3-5 minutes | ~1 minute |
| **Total** | **~6-9 minutes** | **~2 minutes** |

## ✅ Success Checklist

After clean build, verify:

- [ ] `docker compose ps` shows 4 services running
- [ ] `curl http://localhost:3000/health` returns `{"status":"ok"}`
- [ ] `http://localhost:3001` shows admin login page
- [ ] Database has 12 tables
- [ ] `analytics_daily` table has 7 rows
- [ ] Backend tests pass
- [ ] Can login to admin with API key
- [ ] Analytics page shows charts

## 🎯 Quick Clean Build Command

**One-liner to clean and rebuild everything:**

```bash
docker compose down -v && docker system prune -f && docker compose up --build -d && timeout /t 30 && docker compose exec backend npm run compute:analytics -- --days=7
```

**What it does:**
1. Stops and removes all containers and volumes
2. Cleans Docker system
3. Builds and starts all services
4. Waits 30 seconds for services to be ready
5. Computes analytics for last 7 days

## 📚 Additional Resources

- **Full Setup Guide**: MODULE_0_STEPS.md
- **Module 5 Guide**: MODULE_5_STEPS.md
- **Verification Guide**: MODULE_5_VERIFICATION.md
- **Docker Compose Docs**: https://docs.docker.com/compose/

---

## ✅ Answer: YES!

**You can absolutely delete all Docker images and containers and rebuild from scratch.**

The project is fully self-contained with:
- ✅ Dockerfiles for all services
- ✅ docker-compose.yml for orchestration
- ✅ Automatic database initialization (seed.sql)
- ✅ All dependencies defined in package.json files
- ✅ Build scripts and configurations

**Recommended Clean Build Command:**
```bash
cd C:\caceasy
docker compose down -v
docker compose up --build -d
timeout /t 30
docker compose exec backend npm run compute:analytics -- --days=7
```

**Total Time**: ~6-9 minutes for first build
**Result**: Fully working system with all 5 modules operational
