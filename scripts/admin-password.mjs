import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";

// Read from stdin, never command-line arguments or source files.
const prompt = createInterface({ input: process.stdin, output: process.stdout });
const password = await prompt.question("New admin password (at least 14 characters; input is visible): ");
prompt.close();
if (password.length < 14 || password.length > 256) throw new Error("Use 14–256 characters.");
const salt = randomBytes(16).toString("hex");
console.log(`ADMIN_PASSWORD_HASH=${salt}:${scryptSync(password, salt, 64).toString("hex")}`);
