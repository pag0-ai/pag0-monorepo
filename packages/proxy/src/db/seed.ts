import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(databaseUrl);
const seed = readFileSync(join(import.meta.dir, "seed.sql"), "utf-8");

try {
  await sql.unsafe(seed);
  console.log("Seed complete");
} catch (err) {
  console.error("Seed failed:", err);
  process.exit(1);
} finally {
  await sql.end();
}
