#!/usr/bin/env node
import { run } from '../src/cli/main.js';

run(process.argv.slice(2)).catch((err) => {
  console.error(`\n  ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
