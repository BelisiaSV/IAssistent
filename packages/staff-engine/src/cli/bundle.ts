import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadStaff, StaffValidationError } from "../index";

// Usage: bundle <staff dir> <out file>. Validates /staff and writes it as one
// JSON file that the web app imports at build time.
const [dirArg, outArg] = process.argv.slice(2);
if (!dirArg || !outArg) {
  console.error("usage: bundle <staff dir> <out file>");
  process.exit(2);
}

try {
  const { rootDir: _rootDir, ...staff } = await loadStaff(path.resolve(dirArg));
  const out = path.resolve(outArg);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify({ rootDir: "", ...staff }) + "\n");
  console.log(`✔ /staff gebundeld naar ${path.relative(process.cwd(), out)}`);
} catch (error) {
  if (error instanceof StaffValidationError) {
    console.error(`✘ ${error.message}`);
    process.exit(1);
  }
  throw error;
}
