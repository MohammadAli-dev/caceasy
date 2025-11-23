import { Pool } from 'pg';
import { config } from './config';

const pool = new Pool({
    connectionString: config.databaseUrl,
});

pool.on('error', (err: Error) => {
    // This handles idle client errors. 'process' is available globally in Node.js.
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // console.log('executed query', { text, duration, rows: res.rowCount });
    return res;
};

export const getClient = async () => {
    const client = await pool.connect();
    return client;
};

export default pool;
