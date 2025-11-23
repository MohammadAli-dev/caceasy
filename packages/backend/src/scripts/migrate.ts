import fs from 'fs';
import path from 'path';
import { query, getClient } from '../db';

async function migrate() {
    console.log('Starting migration...');
    const client = await getClient();
    try {
        const seedSqlPath = path.resolve(__dirname, '../../../../infra/seed/seed.sql');
        console.log(`Reading SQL from ${seedSqlPath}`);

        if (!fs.existsSync(seedSqlPath)) {
            console.error('Seed SQL file not found!');
            process.exit(1);
        }

        const sql = fs.readFileSync(seedSqlPath, 'utf8');

        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');

        console.log('Migration completed successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
