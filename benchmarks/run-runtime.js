import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generate } from '../src/generator/generator.js';
import { parseCode } from '../src/parser/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ITERATIONS = Number(process.env.BENCH_ITERS || '10');

function compileTypedJS(tjsFile, outFile, mode) {
  const source = fs.readFileSync(path.join(__dirname, tjsFile), 'utf-8');
  const { ast, typeRegistry } = parseCode(source);
  const output = generate(ast, typeRegistry, mode);
  fs.writeFileSync(path.join(__dirname, outFile), output);
  return outFile;
}

function compileTS(tsFile) {
  const tscPath = path.join(__dirname, '../node_modules/.bin/tsc');
  execFileSync(tscPath, [
    tsFile,
    '--target', 'ES2020',
    '--module', 'ES2020',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--lib', 'ES2020,DOM'
  ], {
    cwd: __dirname,
    stdio: 'pipe'
  });
  return tsFile.replace('.ts', '.js');
}

function runNode(file) {
  execFileSync(process.execPath, [file], {
    cwd: __dirname,
    stdio: 'ignore'
  });
}

function measureRuntime(file, iterations) {
  let totalNs = 0n;
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    runNode(file);
    const end = process.hrtime.bigint();
    totalNs += (end - start);
  }
  const avgNs = totalNs / BigInt(iterations);
  return Number(avgNs) / 1e6; // ms
}

function benchmark(name, tjsFile, tsFile) {
  console.log(`\n📊 Runtime Only: ${name}`);
  console.log('-'.repeat(60));

  const results = { name, typedjs: {}, typescript: {} };

  const tjsDevOut = `${tjsFile.replace('.tjs', '')}.dev.js`;
  const tjsProdOut = `${tjsFile.replace('.tjs', '')}.prod.js`;

  try {
    compileTypedJS(tjsFile, tjsDevOut, 'development');
    compileTypedJS(tjsFile, tjsProdOut, 'production');

    const devMs = measureRuntime(tjsDevOut, ITERATIONS);
    const prodMs = measureRuntime(tjsProdOut, ITERATIONS);

    results.typedjs.dev = { avgMs: devMs.toFixed(2) };
    results.typedjs.prod = { avgMs: prodMs.toFixed(2) };

    console.log(`   ✅ TypedJS Dev:  avg ${results.typedjs.dev.avgMs}ms over ${ITERATIONS} runs`);
    console.log(`   ✅ TypedJS Prod: avg ${results.typedjs.prod.avgMs}ms over ${ITERATIONS} runs`);
  } catch (err) {
    results.typedjs.error = err.message;
    console.log(`   ❌ TypedJS failed: ${err.message}`);
  }

  try {
    const tsOut = compileTS(tsFile);
    const tsMs = measureRuntime(tsOut, ITERATIONS);
    results.typescript = { avgMs: tsMs.toFixed(2) };
    console.log(`   ✅ TypeScript JS: avg ${results.typescript.avgMs}ms over ${ITERATIONS} runs`);
  } catch (err) {
    results.typescript = { error: err.message };
    console.log(`   ❌ TypeScript failed: ${err.message}`);
  }

  // Cleanup
  [tjsDevOut, tjsProdOut, tsFile.replace('.ts', '.js')]
    .map(f => path.join(__dirname, f))
    .forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });

  return results;
}

function main() {
  console.log('🚀 TypedJS vs TypeScript Runtime-Only Benchmark\n');
  console.log('='.repeat(60));
  console.log(`Iterations: ${ITERATIONS}`);

  const results = [];
  results.push(benchmark('Simple Benchmark', 'simple.tjs', 'simple.ts'));
  results.push(benchmark('Complex Benchmark', 'complex.tjs', 'complex.ts'));
  results.push(benchmark('Loop Benchmark (Torture Test)', 'loop.tjs', 'loop.ts'));

  console.log('\n' + '='.repeat(60));
  console.log('📈 RUNTIME-ONLY SUMMARY');
  console.log('='.repeat(60));

  results.forEach(result => {
    console.log(`\n${result.name}:`);
    if (result.typedjs?.dev?.avgMs) {
      console.log(`  TypedJS Dev:  ${result.typedjs.dev.avgMs}ms`);
    }
    if (result.typedjs?.prod?.avgMs) {
      console.log(`  TypedJS Prod: ${result.typedjs.prod.avgMs}ms`);
    }
    if (result.typescript?.avgMs) {
      console.log(`  TypeScript JS: ${result.typescript.avgMs}ms`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('✨ Runtime-only benchmark complete!\n');

  fs.writeFileSync(
    path.join(__dirname, 'results-runtime.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('📝 Results saved to benchmarks/results-runtime.json');
}

main();
