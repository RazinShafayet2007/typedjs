import Benchmark from 'benchmark';
import { z } from 'zod';
import Ajv from 'ajv';
import * as rt from 'runtypes';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generate } from '../src/generator/generator.js';
import { parseCode } from '../src/parser/parser.js';
import { checkSmall as codegenSmall, checkMedium as codegenMedium } from './codegen/manual.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const suite = new Benchmark.Suite;
const optionalNotes = [];

async function tryImportIfExists(relPath) {
    const fullPath = path.join(__dirname, relPath);
    if (!fs.existsSync(fullPath)) return null;
    return import(fullPath);
}

// Helper to compile TypedJS source to JS
async function compileTypedJS(source, name) {
    const { ast, typeRegistry } = parseCode(source);
    // Use 'production' mode to get the optimized checks (errors instead of warnings)
    const output = generate(ast, typeRegistry, 'production');

    const outFile = path.join(__dirname, `${name}.js`);
    fs.writeFileSync(outFile, output);
    return import(outFile);
}

// ============================================================================
// 1. SMALL OBJECT SCENARIO
// { name: string, age: number, active: boolean }
// ============================================================================

// --- Zod ---
const zodSmall = z.object({
    name: z.string(),
    age: z.number(),
    active: z.boolean(),
});

// --- AJV ---
const ajv = new Ajv();
const ajvSmallCompiler = ajv.compile({
    type: "object",
    properties: {
        name: { type: "string" },
        age: { type: "number" },
        active: { type: "boolean" }
    },
    required: ["name", "age", "active"],
    additionalProperties: true
});

// --- Runtypes ---
const rtSmall = rt.Object({
    name: rt.String,
    age: rt.Number,
    active: rt.Boolean,
});

// --- TypedJS ---
const tjsSmallSource = `
function checkSmall(data: { name: string; age: number; active: boolean }) {
  return data;
}
export { checkSmall };
`;
const smallLib = await compileTypedJS(tjsSmallSource, 'bench_small_gen');
const smallData = { name: "Razin", age: 18, active: true };


// ============================================================================
// 2. MEDIUM NESTED SCENARIO
// User with Address and Tags (Array)
// ============================================================================

// --- Zod ---
const zodMedium = z.object({
    id: z.number(),
    name: z.string(),
    tags: z.array(z.string()),
    address: z.object({
        street: z.string(),
        zip: z.string()
    })
});

// --- AJV ---
const ajvMediumCompiler = ajv.compile({
    type: "object",
    properties: {
        id: { type: "number" },
        name: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        address: {
            type: "object",
            properties: {
                street: { type: "string" },
                zip: { type: "string" }
            },
            required: ["street", "zip"]
        }
    },
    required: ["id", "name", "tags", "address"]
});

// --- Runtypes ---
const rtMedium = rt.Object({
    id: rt.Number,
    name: rt.String,
    tags: rt.Array(rt.String),
    address: rt.Object({
        street: rt.String,
        zip: rt.String
    })
});

// --- TypedJS ---
const tjsMediumSource = `
interface Address {
  street: string;
  zip: string;
}
interface User {
  id: number;
  name: string;
  tags: Array<string>;
  address: Address;
}
function checkMedium(data: User) {
  return data;
}
export { checkMedium };
`;
const mediumLib = await compileTypedJS(tjsMediumSource, 'bench_medium_gen');

const mediumData = {
    id: 1,
    name: "Razin",
    tags: ["admin", "user", "editor"],
    address: { street: "123 Main St", zip: "10001" }
};

// --- Codegen (Optional: typia, ts-auto-guard) ---
const typiaLib = await tryImportIfExists('codegen/typia.js');
if (!typiaLib) optionalNotes.push('typia (codegen) skipped: benchmarks/codegen/typia.js not found');

const tsAutoGuardLib = await tryImportIfExists('codegen/ts-auto-guard.js');
if (!tsAutoGuardLib) optionalNotes.push('ts-auto-guard (codegen) skipped: benchmarks/codegen/ts-auto-guard.js not found');

// ============================================================================
// SUITE SETUP
// ============================================================================

console.log(`
🚀 Validation Library Showdown
========================================
Node: ${process.version}
Platform: ${process.platform} ${process.arch}
========================================
`);
if (optionalNotes.length > 0) {
    console.log(optionalNotes.join('\n') + '\n');
}

// --- SMALL ---
suite
    .add('TypedJS (Small)', function () {
        smallLib.checkSmall(smallData);
    })
    .add('Zod (Small)', function () {
        zodSmall.parse(smallData);
    })
    .add('Ajv (Small)', function () {
        ajvSmallCompiler(smallData);
    })
    .add('Runtypes (Small)', function () {
        rtSmall.check(smallData);
    })
    .add('Codegen (Manual, Small)', function () {
        codegenSmall(smallData);
    });

if (typiaLib?.checkSmall) {
    suite.add('typia (Small)', function () {
        typiaLib.checkSmall(smallData);
    });
}

if (tsAutoGuardLib?.checkSmall) {
    suite.add('ts-auto-guard (Small)', function () {
        tsAutoGuardLib.checkSmall(smallData);
    });
}

// --- MEDIUM ---
suite
    .add('TypedJS (Medium)', function () {
        mediumLib.checkMedium(mediumData);
    })
    .add('Zod (Medium)', function () {
        zodMedium.parse(mediumData);
    })
    .add('Ajv (Medium)', function () {
        ajvMediumCompiler(mediumData);
    })
    .add('Runtypes (Medium)', function () {
        rtMedium.check(mediumData);
    })
    .add('Codegen (Manual, Medium)', function () {
        codegenMedium(mediumData);
    });

if (typiaLib?.checkMedium) {
    suite.add('typia (Medium)', function () {
        typiaLib.checkMedium(mediumData);
    });
}

if (tsAutoGuardLib?.checkMedium) {
    suite.add('ts-auto-guard (Medium)', function () {
        tsAutoGuardLib.checkMedium(mediumData);
    });
}

suite
    .on('cycle', function (event) {
        console.log(String(event.target));
    })
    .on('complete', function () {
        console.log('\nFastest is ' + this.filter('fastest').map('name'));

        // Cleanup
        [
            path.join(__dirname, 'bench_small_gen.js'),
            path.join(__dirname, 'bench_medium_gen.js')
        ].forEach(f => {
            if (fs.existsSync(f)) fs.unlinkSync(f);
        });
    })
    .run({ 'async': true });
