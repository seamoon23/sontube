import { scryptSync } from "node:crypto";

const password = process.argv[2];
const secret = process.argv[3] ?? process.env.SESSION_SECRET;

if (!password || !secret) {
  console.error("Usage: npm run auth:hash -- <password> <session-secret>");
  console.error("You can also provide SESSION_SECRET in the environment.");
  process.exit(1);
}

console.log(scryptSync(password, secret, 32).toString("hex"));
