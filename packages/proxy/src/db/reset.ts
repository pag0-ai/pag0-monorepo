import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

await sql.unsafe('ALTER TABLE users ALTER COLUMN api_key_hash DROP NOT NULL');
console.log('api_key_hash column is now nullable');

await sql.unsafe('TRUNCATE users, projects, policies, budgets, requests, endpoint_scores, categories, endpoint_metrics_hourly, endpoint_metrics_daily, endpoint_metrics_monthly CASCADE');
console.log('All tables truncated');

await sql.end();
