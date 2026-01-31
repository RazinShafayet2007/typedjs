/**
 * Generator Tests
 * Tests the TypedJS code generator for both dev and prod modes
 */

const generator = require('../src/generator/generator');
const parser = require('../src/parser/parser');

describe('Generator - Dev Mode', () => {
  test('should inject runtime checks for primitives', () => {
    const code = 'let age: number = 25;';
    const ast = parser.parse(code);
    const output = generator.generate(ast, { mode: 'dev' });
    
    expect(output).toContain('__checkType__');
    expect(output).toContain('number');
  });

  test('should inject checks for function parameters', () => {
    const code = 'function add(a: number, b: number): number { return a + b; }';
    const ast = parser.parse(code);
    const output = generator.generate(ast, { mode: 'dev' });
    
    expect(output).toContain('__checkType__');
  });
});

describe('Generator - Prod Mode', () => {
  test('should strip all type annotations', () => {
    const code = 'let age: number = 25;';
    const ast = parser.parse(code);
    const output = generator.generate(ast, { mode: 'prod' });
    
    expect(output).not.toContain('__checkType__');
    expect(output).not.toContain(': number');
    expect(output).toContain('let age = 25');
  });

  test('should remove interface declarations', () => {
    const code = `
      interface User {
        id: number;
        name: string;
      }
      let user: User = { id: 1, name: "John" };
    `;
    const ast = parser.parse(code);
    const output = generator.generate(ast, { mode: 'prod' });
    
    expect(output).not.toContain('interface');
    expect(output).toContain('let user = {');
  });

  test('should strip function type annotations', () => {
    const code = 'function add(a: number, b: number): number { return a + b; }';
    const ast = parser.parse(code);
    const output = generator.generate(ast, { mode: 'prod' });
    
    expect(output).not.toContain(': number');
    expect(output).toContain('function add(a, b)');
  });

  test('should produce pure JavaScript', () => {
    const code = `
      function add(a: number, b: number): number {
        return a + b;
      }
      let result: number = add(5, 10);
    `;
    const ast = parser.parse(code);
    const output = generator.generate(ast, { mode: 'prod' });
    
    expect(output).not.toContain(': number');
    expect(() => eval(output)).not.toThrow();
  });
});

describe('Generator - Performance', () => {
  test('prod mode should be smaller than dev mode', () => {
    const code = `
      function add(a: number, b: number): number {
        return a + b;
      }
    `;
    const ast = parser.parse(code);
    const devOutput = generator.generate(ast, { mode: 'dev' });
    const prodOutput = generator.generate(ast, { mode: 'prod' });
    
    expect(prodOutput.length).toBeLessThan(devOutput.length);
  });
});
