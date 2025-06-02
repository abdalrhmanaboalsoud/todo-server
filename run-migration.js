const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Read and execute the migration file
    const fs = require('fs');
    const migrationSQL = fs.readFileSync('./migration.sql', 'utf8');
    
    await client.query(migrationSQL);
    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration(); 