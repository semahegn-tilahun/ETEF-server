import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { query } from "../src/config/db.js";
import { passwordHash } from "../src/auth.js";

const rl = readline.createInterface({ input, output });
try {
  const fullName = (await rl.question("Full name: ")).trim();
  const email = (await rl.question("Admin email: ")).trim().toLowerCase();
  const password = (await rl.question("Password (minimum 12 characters): ")).trim();
  const confirm = (await rl.question("Confirm password: ")).trim();
  if (!fullName || !email || password.length < 12 || password !== confirm) {
    throw new Error("Invalid input. Use a name, valid email and matching password of at least 12 characters.");
  }
  const hash = await passwordHash(password);
  const result = await query(
    `INSERT INTO admin_users(full_name,email,password_hash,role,is_active)
     VALUES($1,$2,$3,'ADMIN',TRUE)
     ON CONFLICT(email) DO UPDATE SET full_name=EXCLUDED.full_name,password_hash=EXCLUDED.password_hash,is_active=TRUE,updated_at=NOW()
     RETURNING id,email,full_name,role`,
    [fullName,email,hash]
  );
  console.log("Admin account ready:", result.rows[0]);
} catch (error) {
  console.error("Could not create admin:", error.message);
  process.exitCode = 1;
} finally { rl.close(); }
