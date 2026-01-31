/**
 * Analyzer Tests
 * Tests the TypedJS analyzer's ability to catch type errors
 */

const analyzer = require('../src/analyzer');
const parser = require('../src/parser');

describe('Analyzer - Type Mismatches', () => {
  test('should detect string assigned to number', () => {
    const code = 'let age: number = "25";';
    const ast = parser.parse(code);
    const errors = analyzer.analyze(ast);
    
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('type mismatch');
  });

  test('should allow correct type assignment', () => {
    const code = 'let age: number = 25;';
    const ast = parser.parse(code);
    const errors = analyzer.analyze(ast);
    
    expect(errors).toHaveLength(0);
  });
});

describe('Analyzer - Array Type Checking', () => {
  test('should detect wrong array element type', () => {
    const code = 'let scores: Array<number> = [1, 2, "3"];';
    const ast = parser.parse(code);
    const errors = analyzer.analyze(ast);
    
    expect(errors.length).toBeGreaterThan(0);
  });

  test('should allow correct array type', () => {
    const code = 'let scores: Array<number> = [1, 2, 3];';
    const ast = parser.parse(code);
    const errors = analyzer.analyze(ast);
    
    expect(errors).toHaveLength(0);
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
    const ast = parser.parse(code);
    const errors = analyzer.analyze(ast);
    
    expect(errors.length).toBeGreaterThan(0);
  });

  test('should allow correct interface implementation', () => {
    const code = `
      interface User {
        id: number;
        name: string;
      }
      let user: User = { id: 1, name: "John" };
    `;
    const ast = parser.parse(code);
    const errors = analyzer.analyze(ast);
    
    expect(errors).toHaveLength(0);
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
    const ast = parser.parse(code);
    const errors = analyzer.analyze(ast);
    
    expect(errors.length).toBeGreaterThan(0);
  });

  test('should allow correct function', () => {
    const code = `
      function add(a: number, b: number): number {
        return a + b;
      }
      add(5, 10);
    `;
    const ast = parser.parse(code);
    const errors = analyzer.analyze(ast);
    
    expect(errors).toHaveLength(0);
  });
});
