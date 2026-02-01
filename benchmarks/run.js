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
  
  // Benchmark TypedJS Dev Mode
  try {
    console.log('⏱️  TypedJS (Dev Mode)...');
    const start = Date.now();
    // Assuming cli.js is in ../src/cli.js relative to benchmarks folder
    const output = execSync(`node ../src/cli.js ${tjsFile}`, { 
      encoding: 'utf-8',
      cwd: __dirname 
    });
    const time = Date.now() - start;
    
    results.typedjs.dev = {
      time: `${time}ms`,
      success: true
    };
    console.log(`   ✅ Completed in ${time}ms`);
  } catch (err) {
    results.typedjs.dev = { success: false, error: err.message };
    console.log(`   ❌ Failed: ${err.message}`);
  }
  
  // Benchmark TypedJS Prod Mode
  try {
    console.log('⏱️  TypedJS (Prod Mode)...');
    const start = Date.now();
    const output = execSync(`node ../src/cli.js ${tjsFile} --prod`, { 
      encoding: 'utf-8',
      cwd: __dirname 
    });
    const time = Date.now() - start;
    
    results.typedjs.prod = {
      time: `${time}ms`,
      success: true
    };
    console.log(`   ✅ Completed in ${time}ms`);
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
    // ADDED: --lib ES2020,DOM to fix console.log errors
    // REMOVED: stdio: 'ignore' so we can see errors if they happen
    execSync(`npx tsc ${tsFile} --target ES2020 --module ES2020 --moduleResolution node --esModuleInterop --lib ES2020,DOM`, { 
      cwd: __dirname,
      stdio: 'pipe' // Capture output to display on error
    });
    const compileTime = Date.now() - compileStart;
    
    // Execute
    const execStart = Date.now();
    const output = execSync(`node ${jsFile}`, { 
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
    // Log the actual error output from stdout/stderr if available
    const errorDetails = err.stdout ? err.stdout.toString() : (err.stderr ? err.stderr.toString() : err.message);
    console.log(`   ❌ Failed: ${errorDetails.trim()}`);
  }
  
  return results;
}

// Run benchmarks
const results = [];

results.push(benchmark('Simple Benchmark', 'simple.tjs', 'simple.ts'));
results.push(benchmark('Complex Benchmark', 'complex.tjs', 'complex.ts'));

// Summary
console.log('\n' + '='.repeat(60));
console.log('📈 RESULTS SUMMARY');
console.log('='.repeat(60));

results.forEach(result => {
  console.log(`\n${result.name}:`);
  if (result.typedjs && result.typedjs.dev && result.typedjs.dev.success) {
    console.log(`  TypedJS Dev:  ${result.typedjs.dev.time}`);
  }
  if (result.typedjs && result.typedjs.prod && result.typedjs.prod.success) {
    console.log(`  TypedJS Prod: ${result.typedjs.prod.time}`);
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