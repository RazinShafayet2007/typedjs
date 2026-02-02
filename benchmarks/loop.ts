// benchmarks/loop.ts
function add(a: number, b: number): number {
  return a + b;
}

let sum: number = 0;

for (let i: number = 0; i < 1000000; i++) {
  sum = add(sum, 1);
}

console.log("Computed sum:", sum);
export {};