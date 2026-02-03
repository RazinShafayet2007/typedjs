#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { parseCode } from "./parser/parser.js";
import { staticAnalyze, analyze } from "./analyzer/analyzer.js"; // Add staticAnalyze
import { generate } from "./generator/generator.js";

const args = process.argv.slice(2);

if (args.includes('-v') || args.includes('--version')) {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
  console.log(`v${packageJson.version}`);
  process.exit(0);
}

if (args.includes('-h') || args.includes('--help')) {
  console.log(`
Usage: typedjs <file.tjs> [options]

Options:
  -v, --version      Show version number
  -h, --help        Show this help message
  --prod            Enable production mode (errors instead of warnings)
  --bench-meta      Internal flag for benchmarking
`);
  process.exit(0);
}

const isProd = args.includes('--prod');
const fileArg = args.find(a => !a.startsWith('--') && !a.startsWith('-'));

if (!fileArg) {
  console.error("Usage: typedjs <file.tjs> [--prod]");
  process.exit(1);
}

const isBench = args.includes('--bench-meta');

let compileStart = performance.now();

const filePath = path.resolve(fileArg);
const source = fs.readFileSync(filePath, "utf-8");

const { ast, typeRegistry } = parseCode(source);

// Static analysis (Always run it, but in prod it's CRITICAL)
const staticErrors = staticAnalyze(typeRegistry, ast);
if (!staticErrors && isProd) { // staticAnalyze returns false if errors found (wait, logic check)
  // staticAnalyze returns boolean? Let's check. 
  // It returns `errors.length === 0`. So true means OK.
  console.error("Build failed due to static type errors.");
  process.exit(1);
}

// Old minimal analyze (deprecated but keeping for now)
analyze(typeRegistry);

const output = generate(ast, typeRegistry, isProd ? 'production' : 'development');
const compileTime = performance.now() - compileStart;

const tmpFile = path.resolve("./typedjs_temp.js");
fs.writeFileSync(tmpFile, output);

let execStart = performance.now();
try {
  await import(tmpFile);
} finally {
  if (isBench) {
    const execTime = performance.now() - execStart;
    console.log(`__BENCH__${JSON.stringify({ compileTime, execTime })}`);
  }
  fs.unlinkSync(tmpFile);
}