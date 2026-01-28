#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { parseCode } from "./parser/parser.js";
import { staticAnalyze, analyze } from "./analyzer/analyzer.js"; // Add staticAnalyze
import { generate } from "./generator/generator.js";

const args = process.argv.slice(2);

const isProd = args.includes('--prod');
const fileArg = args.find(a => !a.startsWith('--'));

if (!fileArg) {
  console.error("Usage: typedjs <file.tjs> [--prod]");
  process.exit(1);
}

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

const tmpFile = path.resolve("./typedjs_temp.js");
fs.writeFileSync(tmpFile, output);

await import(tmpFile);

fs.unlinkSync(tmpFile);