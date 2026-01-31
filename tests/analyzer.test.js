/**
 * Analyzer Tests
 * Tests the TypedJS analyzer - it extracts type information
 */

import { staticAnalyze, analyze } from '../src/analyzer/analyzer.js';
import { parseCode } from '../src/parser/parser.js';

describe('Analyzer - Type Registry', () => {
  test('should extract variable types', () => {
    const code = 'let age: number = 25;';
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    expect(result.typeRegistry).toHaveLength(1);
    expect(result.typeRegistry[0].name).toBe('age');
    expect(result.typeRegistry[0].type).toBe('number');
  });

  test('should extract multiple variable types', () => {
    const code = `
      let name: string = "John";
      let age: number = 25;
      let active: boolean = true;
    `;
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    expect(result.typeRegistry).toHaveLength(3);
  });
});

describe('Analyzer - Interface Extraction', () => {
  test('should extract interface definitions', () => {
    const code = `
      interface User {
        id: number;
        name: string;
      }
    `;
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    const userInterface = result.typeRegistry.find(t => t.name === 'User');
    expect(userInterface).toBeDefined();
    expect(userInterface.kind).toBe('interface');
  });

  test('should extract interface shape', () => {
    const code = `
      interface User {
        id: number;
        name: string;
      }
    `;
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    const userInterface = result.typeRegistry.find(t => t.name === 'User');
    expect(userInterface.shape).toHaveProperty('id');
    expect(userInterface.shape).toHaveProperty('name');
  });
});

describe('Analyzer - Function Types', () => {
  test('should extract function signatures', () => {
    const code = 'function add(a: number, b: number): number { return a + b; }';
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    const addFunc = result.typeRegistry.find(t => t.name === 'add');
    expect(addFunc).toBeDefined();
    expect(addFunc.kind).toBe('function');
    expect(addFunc.returnType).toBe('number');
  });

  test('should extract function parameters', () => {
    const code = 'function greet(name: string): string { return "Hello"; }';
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    const greetFunc = result.typeRegistry.find(t => t.name === 'greet');
    expect(greetFunc.params).toHaveLength(1);
    expect(greetFunc.params[0].type).toBe('string');
  });
});

describe('Analyzer - Complex Types', () => {
  test('should handle array types', () => {
    const code = 'let scores: Array<number> = [1, 2, 3];';
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    expect(result.typeRegistry[0].type.kind).toBe('array');
    expect(result.typeRegistry[0].type.elementType).toBe('number');
  });

  test('should work with mixed code', () => {
    const code = `
      interface User {
        id: number;
      }
      function getUser(): User {
        return { id: 1 };
      }
      let user: User = getUser();
    `;
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    expect(result.typeRegistry.length).toBeGreaterThan(0);
  });
});
