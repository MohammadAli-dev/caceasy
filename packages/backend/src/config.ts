import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env if available, or local .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/caceasy',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    jwtSecret: process.env.JWT_SECRET || 'dev_secret_do_not_use_in_prod',
    adminApiKey: process.env.ADMIN_API_KEY || 'dev_admin_key',
    adminRateLimit: parseInt(process.env.ADMIN_RATE_LIMIT || '20', 10),
};

// Fail fast if JWT_SECRET is not set in production
if (config.nodeEnv === 'production' && config.jwtSecret === 'dev_secret_do_not_use_in_prod') {
    console.error('FATAL: JWT_SECRET must be set in production!');
    process.exit(1);
}

// Fail fast if ADMIN_API_KEY is not set in production
if (config.nodeEnv === 'production' && config.adminApiKey === 'dev_admin_key') {
    console.error('FATAL: ADMIN_API_KEY must be set in production!');
    process.exit(1);
}
