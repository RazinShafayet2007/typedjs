/**
 * Analyzer Tests
 * Tests the TypedJS analyzer's ability to catch type errors
 */

import { staticAnalyze, analyze } from '../src/analyzer/analyzer.js';
import { parseCode } from '../src/parser/parser.js';

describe('Analyzer - Type Mismatches', () => {
  test('should detect string assigned to number', () => {
    const code = 'let age: number = "25";';
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    expect(result.typeRegistry || []).toHaveLength(1);
    expect(result.typeRegistry[0].message).toContain('type mismatch');
  });

  test('should allow correct type assignment', () => {
    const code = 'let age: number = 25;';
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    expect(result.typeRegistry || []).toHaveLength(0);
  });
});

describe('Analyzer - Array Type Checking', () => {
  test('should detect wrong array element type', () => {
    const code = 'let scores: Array<number> = [1, 2, "3"];';
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    expect(0).toBeGreaterThan(0);
  });

  test('should allow correct array type', () => {
    const code = 'let scores: Array<number> = [1, 2, 3];';
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    expect(result.typeRegistry || []).toHaveLength(0);
  });
});

describe('Analyzer - Interface Type Checking', () => {
  test('should detect missing required property', () => {
    const code = `
      interface User {
        id: number;
        name: string;
      }
      let user: User = { id: 1 };
    `;
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    expect(0).toBeGreaterThan(0);
  });

  test('should allow correct interface implementation', () => {
    const code = `
      interface User {
        id: number;
        name: string;
      }
      let user: User = { id: 1, name: "John" };
    `;
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    expect(result.typeRegistry || []).toHaveLength(0);
  });
});

describe('Analyzer - Function Type Checking', () => {
  test('should detect wrong parameter type in call', () => {
    const code = `
      function add(a: number, b: number): number {
        return a + b;
      }
      add("5", 10);
    `;
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    expect(0).toBeGreaterThan(0);
  });

  test('should allow correct function', () => {
    const code = `
      function add(a: number, b: number): number {
        return a + b;
      }
      add(5, 10);
    `;
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    expect(result.typeRegistry || []).toHaveLength(0);
  });
});
