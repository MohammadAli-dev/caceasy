import { query } from '../db';

async function seed() {
    console.log('Starting seed...');
    try {
        // Check if we already have users
        const existingUsers = await query('SELECT count(*) FROM users');
        if (parseInt(existingUsers.rows[0].count) > 0) {
            console.log('Database already seeded.');
            process.exit(0);
        }

        // Insert a test user
        const userRes = await query(`
      INSERT INTO users (email, name) 
      VALUES ($1, $2) 
      RETURNING id
    `, ['test@example.com', 'Test User']);

        const userId = userRes.rows[0].id;
        console.log(`Created test user: ${userId}`);

        // Create a batch
        const batchRes = await query(`
      INSERT INTO batches (points_per_coupon, quantity)
      VALUES ($1, $2)
      RETURNING id
    `, [100, 10]);
        const batchId = batchRes.rows[0].id;
        console.log(`Created batch: ${batchId}`);

        console.log('Seed completed successfully.');
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

seed();
