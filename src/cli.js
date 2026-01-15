#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { parseCode } from "./parser/parser.js";
import { analyze } from "./analyzer/analyzer.js";
import { generate } from "./generator/generator.js";

const args = process.argv.slice(2);

if (!args[0]) {
  console.error("Usage: typedjs <file.js>");
  process.exit(1);
}

const filePath = path.resolve(args[0]);
const source = fs.readFileSync(filePath, "utf-8");

// Parse AST and collect types
const { ast, typeRegistry } = parseCode(source);

// Analyze (currently minimal)
analyze(typeRegistry);  // Note: analyzer might need updates later for functions

// Generate JS with runtime checks
const output = generate(ast, typeRegistry);

// Write to temporary file
const tmpFile = path.resolve("./typedjs_temp.js");
fs.writeFileSync(tmpFile, output);

// Execute the temporary file
await import(tmpFile);

// Delete temporary file
fs.unlinkSync(tmpFile);