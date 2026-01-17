#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { parseCode } from "./parser/parser.js";
import { staticAnalyze, analyze } from "./analyzer/analyzer.js"; // Add staticAnalyze
import { generate } from "./generator/generator.js";

const args = process.argv.slice(2);

if (!args[0]) {
  console.error("Usage: typedjs <file.js>");
  process.exit(1);
}

const filePath = path.resolve(args[0]);
const source = fs.readFileSync(filePath, "utf-8");

const { ast, typeRegistry } = parseCode(source);

// Static analysis first
staticAnalyze(typeRegistry, ast);

// Old minimal analyze
analyze(typeRegistry);

const output = generate(ast, typeRegistry);

const tmpFile = path.resolve("./typedjs_temp.js");
fs.writeFileSync(tmpFile, output);

await import(tmpFile);

fs.unlinkSync(tmpFile);