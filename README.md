# Caceasy Monorepo

This is the monorepo for Caceasy, containing the backend API, admin dashboard, and mobile app.

## Prerequisites

- Docker & Docker Compose
- Node.js 18+
- npm

## Getting Started

1.  **Clone the repository**
2.  **Install dependencies**
    ```bash
    npm install
    ```
3.  **Start the development environment**
    ```bash
    docker compose up --build
    ```
    This will start:
    - Postgres (port 5432)
    - Redis (port 6379)
    - Backend API (port 3000)
    - Admin Dashboard (port 3001)

4.  **Seed the database** (Run in a separate terminal while docker is running)
    ```bash
    # You can run this from the host if you have ts-node installed, 
    # or exec into the container
    docker compose exec backend npm run migrate
    docker compose exec backend npm run seed
    ```

## Project Structure

- `packages/backend`: Express + TypeScript API
- `packages/admin`: Next.js Admin Dashboard
- `packages/mobile`: Expo React Native App
- `infra`: Infrastructure configuration (SQL seeds)

## API Usage

### Health Check
```bash
curl http://localhost:3000/health
```

### Generate Coupons
```bash
curl -X POST http://localhost:3000/coupons/generate \
  -H "Content-Type: application/json" \
  -d '{"quantity": 5, "points": 100}'
```

### Scan Coupon
```bash
# Replace TOKEN and USER_ID with actual values
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN_HERE",
    "user_id": "YOUR_USER_ID_HERE",
    "device_id": "dev-1",
    "gps": {"lat": 0, "long": 0}
  }'
```

## Running Tests

### Option 1: Local (requires Node.js installed)

To run backend tests (including concurrency checks):

```bash
# Ensure DB is running (or use the CI setup)
cd packages/backend
npm test
```

### Option 2: Docker (no local Node.js required)

You can run the tests inside the Docker container:

```bash
docker compose run --rm backend npm test
```

## CI/CD

GitHub Actions workflow is defined in `.github/workflows/ci.yml`. It runs linting, typechecking, and tests on every push to main.
