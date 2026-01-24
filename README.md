# TypedJS

A lightweight, runtime-checkable type system for JavaScript. It brings the safety of TypeScript with the simplicity of running directly in Node.js (via a transparent runtime).

## Features

- **Runtime Type Checking**: Catches type errors as your code runs (Development Mode).
- **Fast Production Mode**: Strips checks for raw JavaScript speed (matching TypeScript performance).
- **No Build Step**: Run `.js` files directly with the `typedjs` CLI.
- **Support for Modern Types**: Includes Maps, Sets, Tuples, and Unions.

## Installation

```bash
npm install -g @razinshafayet/typedjs
```

## Usage

### 1. Development Mode (Safe)
Runs your code with full runtime type checking. Great for debugging.

```bash
typedjs app.js
```

### 2. Production Mode (Fast)
Strips all types and runtime checks. Executes as fast as raw JavaScript. Use this for deployment.

```bash
typedjs app.js --prod
```

## Supported Type Annotations

TypedJS supports a subset of TypeScript syntax, focused on runtime-validatable types.

### Primitives
```javascript
let name: string = "Razin";
let age: number = 25;
let isActive: boolean = true;
let empty: null = null;
let notDefined: undefined = undefined;
let big: bigint = 9007199254740991n;
let sym: symbol = Symbol("id");
```

### Interfaces & Objects
```javascript
interface User {
  id: number;
  name: string;
  email?: string; // Optional property
}

let user: User = {
  id: 1,
  name: "Razin"
};
```

### Type Aliases & Unions
```javascript
type ID = string | number;
type Status = "active" | "inactive" | "pending"; // Literal Unions

let myId: ID = 123;
let status: Status = "active";
```

### Arrays & Tuples
```javascript
let scores: Array<number> = [10, 20, 30];
let point: [number, number] = [10, 20]; // Tuple
```

### Maps & Sets
```javascript
let map: Map<string, number> = new Map();
let set: Set<string> = new Set();
```

### Functions
```javascript
function add(a: number, b: number): number {
  return a + b;
}
```

## How It Works

TypedJS includes a smart parser and runtime generator:
1.  **Parser**: Reads your TypedJS syntax (using `acorn-typescript`).
2.  **Analyzer**: Performs static analysis to catch obvious errors early.
3.  **Generator**:
    *   **Dev Mode**: Injects `__checkType__` calls around every variable assignment and function call.
    *   **Prod Mode**: Removes all types and checks, outputting pure optimized JavaScript.
