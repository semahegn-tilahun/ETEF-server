import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, pool } from "../src/config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../database");

try {
  await query(`CREATE TABLE IF NOT EXISTS _migrations (name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const files = (await fs.readdir(migrationsDir))
    .filter((name) => /^migration_\d+.*\.sql$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const applied = await query("SELECT name FROM _migrations");
  const appliedNames = new Set(applied.rows.map((row) => row.name));

  if (!files.length) {
    console.log("No migration files found.");
    process.exit(0);
  }

  for (const file of files) {
    if (appliedNames.has(file)) {
      console.log(`SKIP ${file}`);
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations(name) VALUES($1)", [file]);
      await client.query("COMMIT");
      console.log(`APPLIED ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`${file}: ${error.message}`);
    } finally {
      client.release();
    }
  }

  console.log("Database migrations completed successfully.");
} catch (error) {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
