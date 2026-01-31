# TypedJS Benchmarks

## Running Benchmarks
```bash
cd benchmarks
node run.js
```

## Benchmark Files

- `simple.tjs` / `simple.ts` - Basic types and functions
- `complex.tjs` / `complex.ts` - Nested types, interfaces, complex logic

## What Gets Measured

1. **TypedJS Dev Mode** - Runtime type checking enabled
2. **TypedJS Prod Mode** - Types stripped, no runtime overhead
3. **TypeScript** - Compile + execution time

## Results

Results are saved to `results.json` after each run.
