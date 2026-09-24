// Fails loudly (but does not block) when the site is still carrying
// placeholder company details. Runs as part of `npm run build`.
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/data/siteContent.js", import.meta.url), "utf8");
const pending = [...src.matchAll(/^\s*\/\/\s*TODO:\s*(.+)$/gm)].map((m) => m[1].trim());
const todoValues = [...src.matchAll(/"(TODO-[A-Z-]+)"/g)].map((m) => m[1]);

if (pending.length || todoValues.length) {
  const bar = "─".repeat(64);
  console.warn(`\n\x1b[33m${bar}\n⚠  SUPER GRAPHIC: ${pending.length} placeholder detail(s) still in siteContent.js\n${bar}\x1b[0m`);
  pending.forEach((p) => console.warn(`   • ${p}`));
  if (todoValues.length) console.warn(`   • unset values: ${[...new Set(todoValues)].join(", ")}`);
  console.warn(`\x1b[33m${bar}\n   The build continues, but do not point the live domain at it yet.\n${bar}\x1b[0m\n`);
} else {
  console.log("\x1b[32m✓ Super Graphic: no placeholder company details remain.\x1b[0m");
}
