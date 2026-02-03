import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 TypedJS vs TypeScript Benchmark\n');
console.log('='.repeat(60));

function benchmark(name, tjsFile, tsFile) {
  console.log(`\n📊 Running: ${name}`);
  console.log('-'.repeat(60));

  const results = {
    name,
    typedjs: { dev: {}, prod: {} },
    typescript: {}
  };

  // Helper to run TypedJS and parse metrics
  function runTypedJS(file, isProd) {
    const flag = isProd ? '--prod' : '';
    // Use --bench-meta to get internal timing metrics
    const output = execSync(`node ../src/cli.js ${file} ${flag} --bench-meta`, {
      encoding: 'utf-8',
      cwd: __dirname
    });

    const benchMatch = output.match(/__BENCH__(\{.*\})/);
    let metrics = {};
    if (benchMatch) {
      metrics = JSON.parse(benchMatch[1]);
    }

    return {
      compileTime: metrics.compileTime ? `${metrics.compileTime.toFixed(2)}ms` : '?',
      execTime: metrics.execTime ? `${metrics.execTime.toFixed(2)}ms` : '?',
      totalTime: metrics.compileTime && metrics.execTime ? `${(metrics.compileTime + metrics.execTime).toFixed(2)}ms` : '?'
    };
  }

  // Benchmark TypedJS Dev Mode
  try {
    console.log('⏱️  TypedJS (Dev Mode)...');
    const m = runTypedJS(tjsFile, false);

    results.typedjs.dev = {
      ...m,
      success: true
    };
    console.log(`   ✅ Compiled in ${m.compileTime}, executed in ${m.execTime} (total: ${m.totalTime})`);
  } catch (err) {
    results.typedjs.dev = { success: false, error: err.message };
    console.log(`   ❌ Failed: ${err.message}`);
  }

  // Benchmark TypedJS Prod Mode
  try {
    console.log('⏱️  TypedJS (Prod Mode)...');
    const m = runTypedJS(tjsFile, true);

    results.typedjs.prod = {
      ...m,
      success: true
    };
    console.log(`   ✅ Compiled in ${m.compileTime}, executed in ${m.execTime} (total: ${m.totalTime})`);
  } catch (err) {
    results.typedjs.prod = { success: false, error: err.message };
    console.log(`   ❌ Failed: ${err.message}`);
  }

  // Benchmark TypeScript
  try {
    console.log('⏱️  TypeScript...');
    const jsFile = tsFile.replace('.ts', '.js');

    // Compile
    const compileStart = Date.now();
    execSync(`npx tsc ${tsFile} --target ES2020 --module ES2020 --moduleResolution node --esModuleInterop --lib ES2020,DOM`, {
      cwd: __dirname,
      stdio: 'pipe'
    });
    const compileTime = Date.now() - compileStart;

    // Execute
    const execStart = Date.now();
    execSync(`node ${jsFile}`, {
      encoding: 'utf-8',
      cwd: __dirname
    });
    const execTime = Date.now() - execStart;
    const totalTime = compileTime + execTime;

    // Get file sizes
    const tsSize = fs.statSync(path.join(__dirname, tsFile)).size;
    const jsSize = fs.statSync(path.join(__dirname, jsFile)).size;

    results.typescript = {
      compileTime: `${compileTime}ms`,
      execTime: `${execTime}ms`,
      totalTime: `${totalTime}ms`,
      tsSize: `${tsSize} bytes`,
      jsSize: `${jsSize} bytes`,
      success: true
    };
    console.log(`   ✅ Compiled in ${compileTime}ms, executed in ${execTime}ms (total: ${totalTime}ms)`);

    // Cleanup
    if (fs.existsSync(path.join(__dirname, jsFile))) {
      fs.unlinkSync(path.join(__dirname, jsFile));
    }
  } catch (err) {
    results.typescript = { success: false, error: err.message };
    const errorDetails = err.stdout ? err.stdout.toString() : (err.stderr ? err.stderr.toString() : err.message);
    console.log(`   ❌ Failed: ${errorDetails.trim()}`);
  }

  return results;
}

// Run benchmarks
const results = [];

results.push(benchmark('Simple Benchmark', 'simple.tjs', 'simple.ts'));
results.push(benchmark('Complex Benchmark', 'complex.tjs', 'complex.ts'));
results.push(benchmark('Loop Benchmark (Torture Test)', 'loop.tjs', 'loop.ts'));

// Summary
console.log('\n' + '='.repeat(60));
console.log('📈 RESULTS SUMMARY');
console.log('='.repeat(60));

results.forEach(result => {
  console.log(`\n${result.name}:`);
  if (result.typedjs && result.typedjs.dev && result.typedjs.dev.success) {
    console.log(`  TypedJS Dev:  ${result.typedjs.dev.totalTime} (compile: ${result.typedjs.dev.compileTime}, exec: ${result.typedjs.dev.execTime})`);
  }
  if (result.typedjs && result.typedjs.prod && result.typedjs.prod.success) {
    console.log(`  TypedJS Prod: ${result.typedjs.prod.totalTime} (compile: ${result.typedjs.prod.compileTime}, exec: ${result.typedjs.prod.execTime})`);
  }
  if (result.typescript && result.typescript.success) {
    console.log(`  TypeScript:   ${result.typescript.totalTime} (compile: ${result.typescript.compileTime}, exec: ${result.typescript.execTime})`);
  } else if (result.typescript && !result.typescript.success) {
    console.log(`  TypeScript:   Failed`);
  }
});

console.log('\n' + '='.repeat(60));
console.log('✨ Benchmark complete!\n');

// Save results
fs.writeFileSync(
  path.join(__dirname, 'results.json'),
  JSON.stringify(results, null, 2)
);
console.log('📝 Results saved to benchmarks/results.json');