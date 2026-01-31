/**
 * Parser Tests
 * Tests the TypedJS parser's ability to parse type annotations
 */

import parser from '../src/parser/parser.js';

describe('Parser - Primitives', () => {
  test('should parse string type annotation', () => {
    const code = 'let name: string = "John";';
    const ast = parser.parse(code);
    
    expect(ast).toBeDefined();
    expect(ast.type).toBe('Program');
    const declaration = ast.body[0].declarations[0];
    expect(declaration.id.typeAnnotation).toBeDefined();
    expect(declaration.id.typeAnnotation.typeAnnotation.type).toBe('TSStringKeyword');
  });

  test('should parse number type annotation', () => {
    const code = 'let age: number = 25;';
    const ast = parser.parse(code);
    
    const declaration = ast.body[0].declarations[0];
    expect(declaration.id.typeAnnotation.typeAnnotation.type).toBe('TSNumberKeyword');
  });

  test('should parse boolean type annotation', () => {
    const code = 'let isActive: boolean = true;';
    const ast = parser.parse(code);
    
    const declaration = ast.body[0].declarations[0];
    expect(declaration.id.typeAnnotation.typeAnnotation.type).toBe('TSBooleanKeyword');
  });

  test('should parse array type annotation', () => {
    const code = 'let scores: Array<number> = [1, 2, 3];';
    const ast = parser.parse(code);
    
    const declaration = ast.body[0].declarations[0];
    expect(declaration.id.typeAnnotation.typeAnnotation.type).toBe('TSTypeReference');
  });

  test('should parse tuple type annotation', () => {
    const code = 'let point: [number, number] = [10, 20];';
    const ast = parser.parse(code);
    
    const declaration = ast.body[0].declarations[0];
    expect(declaration.id.typeAnnotation.typeAnnotation.type).toBe('TSTupleType');
  });
});

describe('Parser - Union Types', () => {
  test('should parse simple union type', () => {
    const code = 'let id: string | number = 123;';
    const ast = parser.parse(code);
    
    const declaration = ast.body[0].declarations[0];
    expect(declaration.id.typeAnnotation.typeAnnotation.type).toBe('TSUnionType');
  });
});

describe('Parser - Interfaces', () => {
  test('should parse simple interface', () => {
    const code = `
      interface User {
        id: number;
        name: string;
      }
    `;
    const ast = parser.parse(code);
    
    expect(ast.body[0].type).toBe('TSInterfaceDeclaration');
    expect(ast.body[0].id.name).toBe('User');
  });

  test('should parse interface with optional properties', () => {
    const code = `
      interface User {
        id: number;
        email?: string;
      }
    `;
    const ast = parser.parse(code);
    
    const emailProperty = ast.body[0].body.body[1];
    expect(emailProperty.optional).toBe(true);
  });
});

describe('Parser - Functions', () => {
  test('should parse function with typed parameters', () => {
    const code = 'function add(a: number, b: number) { return a + b; }';
    const ast = parser.parse(code);
    
    const func = ast.body[0];
    expect(func.params[0].typeAnnotation).toBeDefined();
    expect(func.params[1].typeAnnotation).toBeDefined();
  });

  test('should parse function with return type', () => {
    const code = 'function add(a: number, b: number): number { return a + b; }';
    const ast = parser.parse(code);
    
    const func = ast.body[0];
    expect(func.returnType).toBeDefined();
  });
});
