import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = postgres(databaseUrl, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
  transform: {
    undefined: null,
  },
});

export default sql;
