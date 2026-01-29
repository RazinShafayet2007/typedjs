# TypedJS

A comprehensive runtime type system for JavaScript with full TypeScript compatibility. Runtime type checking meets the power of TypeScript's type system.

## Features

- **🎯 Complete TypeScript Type System**: Support for all TypeScript types including unions, intersections, tuples, generics, enums, and utility types
- **🔍 Runtime Type Checking**: Catches type errors as your code runs in development mode
- **⚡ Fast Production Mode**: Strips all types and checks for native JavaScript performance
- **🚀 Zero Build Step**: Run `.tjs` files directly with the `typedjs` CLI
- **📦 Modern Types**: Full support for Maps, Sets, Tuples, Records, Template Literals, and more
- **✨ Advanced Features**: Conditional types, mapped types, type operators (keyof, typeof)

## Installation
```bash
npm install -g @razinshafayet/typedjs
```

## Usage

### Development Mode (with Runtime Validation)
Full runtime type checking - catches bugs TypeScript misses:
```bash
typedjs app.tjs
```

### Production Mode (Optimized)
Strips all types and runtime checks for maximum performance:
```bash
typedjs app.tjs --prod
```

## Comprehensive Type Support

### Basic Types
```javascript
let name: string = "Razin";
let age: number = 25;
let isActive: boolean = true;
let empty: null = null;
let notDefined: undefined = undefined;
let big: bigint = 9007199254740991n;
let sym: symbol = Symbol("id");
```

### Advanced Primitives
```javascript
let anyValue: any = "anything";
let unknownValue: unknown = getValue();
let neverReturns: never; // For functions that never return
function log(): void { console.log("void"); }
```

### Interfaces & Objects
```javascript
interface User {
  id: number;
  name: string;
  email?: string; // Optional property
  readonly created: Date; // Readonly property
}

let user: User = {
  id: 1,
  name: "Razin",
  created: new Date()
};
```

### Type Aliases, Unions & Intersections
```javascript
// Type alias
type ID = string | number;

// Union types
type Status = "active" | "inactive" | "pending";

// Intersection types
type Named = { name: string };
type Aged = { age: number };
type Person = Named & Aged;

let myId: ID = 123;
let status: Status = "active";
let person: Person = { name: "Alice", age: 30 };
```

### Arrays & Tuples
```javascript
// Arrays
let scores: Array<number> = [10, 20, 30];
let names: string[] = ["Alice", "Bob"];
let readonly: ReadonlyArray<number> = [1, 2, 3];

// Tuples
let point: [number, number] = [10, 20];
let labeled: [x: number, y: number] = [5, 10];
let optional: [string, number?] = ["test"];
let rest: [string, ...number[]] = ["items", 1, 2, 3];
```

### Collections
```javascript
// Map
let userMap: Map<string, number> = new Map();
userMap.set("alice", 30);

// Set
let uniqueIds: Set<number> = new Set([1, 2, 3]);

// Record
type Ages = Record<string, number>;
const ages: Ages = { alice: 30, bob: 25 };
```

### Enums
```javascript
// Numeric enum
enum Color {
  Red,
  Green,
  Blue
}

// String enum
enum Status {
  Active = "ACTIVE",
  Inactive = "INACTIVE"
}

let color: Color = Color.Red;
let status: Status = Status.Active;
```

### Functions
```javascript
// Basic function
function add(a: number, b: number): number {
  return a + b;
}

// Function types
type MathOperation = (a: number, b: number) => number;

// Optional and rest parameters
function greet(name: string, title?: string): string {
  return title ? `${title} ${name}` : name;
}

function sum(...numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0);
}
```

### Utility Types
```javascript
interface Todo {
  title: string;
  description: string;
  completed: boolean;
}

// Make all properties optional
type PartialTodo = Partial<Todo>;

// Make all properties required
type RequiredTodo = Required<Todo>;

// Make all properties readonly
type ReadonlyTodo = Readonly<Todo>;

// Pick specific properties
type TodoPreview = Pick<Todo, "title" | "completed">;

// Omit specific properties
type TodoInfo = Omit<Todo, "completed">;
```

### Template Literal Types
```javascript
type EventName = `on${Capitalize<string>}`;
type Direction = "left" | "right";
type Position = `${Direction}-${number}`;
```

### Type Operators
```javascript
// keyof
type UserKeys = keyof User; // "id" | "name" | "email" | "created"

// typeof
const config = { host: "localhost", port: 3000 };
type Config = typeof config;

// Indexed access
type UserId = User["id"]; // number
```

## How It Works

TypedJS provides a complete type checking system:

1. **Parser**: Uses `acorn-typescript` to parse TypeScript syntax in `.tjs` files
2. **Analyzer**: Performs static analysis to catch type errors before runtime
3. **Generator**: 
   - **Dev Mode**: Injects comprehensive runtime type checks
   - **Prod Mode**: Strips all types and generates optimized JavaScript

### Development vs Production

**Development Mode (`typedjs app.tjs`):**
- Full runtime validation
- Catches type mismatches at runtime
- Validates API responses, user input, external data
- Detailed error messages

**Production Mode (`typedjs app.tjs --prod`):**
- All type annotations removed
- No runtime overhead
- Same performance as vanilla JavaScript
- Optimized for deployment

## VS Code Extension

Get the full TypedJS experience with syntax highlighting, type validation, and IntelliSense:
```bash
code --install-extension razinshafayet.typedjs-vscode
```

Features:
- Full TypeScript syntax highlighting
- Real-time type validation
- IntelliSense for all types
- Hover information
- Code snippets

## Why TypedJS?

**TypeScript** catches bugs at compile time but types disappear at runtime.  
**TypedJS** catches bugs at compile time AND validates types at runtime.

Perfect for:
- API response validation
- User input validation
- External data validation
- Development debugging
- Type-safe JavaScript without build steps

## Examples

See the `/examples` directory for comprehensive examples of:
- Interface usage
- Type aliases and unions
- Enums
- Generic functions
- Utility types
- Real-world patterns

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=razinshafayet.typedjs-vscode)
- [GitHub Repository](https://github.com/RazinShafayet2007/typedjs)
- [Report Issues](https://github.com/RazinShafayet2007/typedjs/issues)
- [npm Package](https://www.npmjs.com/package/@razinshafayet/typedjs)

---

**Made with ❤️ by [Razin Shafayet](https://github.com/RazinShafayet2007)**