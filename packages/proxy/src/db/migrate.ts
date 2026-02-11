import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(databaseUrl);
const schema = readFileSync(join(import.meta.dir, "schema.sql"), "utf-8");

try {
  await sql.unsafe(schema);
  console.log("Migration complete");
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await sql.end();
}
