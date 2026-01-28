#!/usr/bin/env node
// TypedJS Test Runner

import { execSync, exec } from 'child_process';
import { readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testsDir = __dirname;
const cliPath = path.resolve(__dirname, '../src/cli.js');

// Get all .tjs files in the tests directory
const testFiles = readdirSync(testsDir)
    .filter(f => f.endsWith('.tjs'))
    .sort();

console.log('╔════════════════════════════════════════════╗');
console.log('║       TypedJS Test Runner                  ║');
console.log('╚════════════════════════════════════════════╝');
console.log(`\nFound ${testFiles.length} test files\n`);

let passed = 0;
let failed = 0;
const results = [];

for (const file of testFiles) {
    const testPath = path.join(testsDir, file);
    const testName = file.replace('.tjs', '');

    process.stdout.write(`Testing ${testName.padEnd(25)} ... `);

    try {
        // Run the test file
        execSync(`node "${cliPath}" "${testPath}"`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 10000
        });

        console.log('✅ PASS');
        passed++;
        results.push({ name: testName, status: 'pass' });
    } catch (error) {
        console.log('❌ FAIL');
        failed++;
        results.push({
            name: testName,
            status: 'fail',
            error: error.stderr || error.message
        });
    }
}

// Summary
console.log('\n' + '═'.repeat(50));
console.log(`\nTest Summary:`);
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
console.log(`  📊 Total:  ${testFiles.length}`);

// Show errors for failed tests
if (failed > 0) {
    console.log('\n--- Failed Tests ---\n');
    for (const result of results.filter(r => r.status === 'fail')) {
        console.log(`\n❌ ${result.name}:`);
        console.log(result.error?.substring(0, 500) || 'Unknown error');
    }
    process.exit(1);
} else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
}
