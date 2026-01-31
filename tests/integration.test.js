/**
 * Integration Tests
 * End-to-end tests for TypedJS workflow
 */

import { parseCode } from '../src/parser/parser.js';
import { analyze } from '../src/analyzer/analyzer.js';
import { generate } from '../src/generator/generator.js';

describe('Integration - Full Workflow', () => {
  test('parse -> analyze -> generate works', () => {
    const code = `
      let x: number = 10;
      let y: number = 20;
    `;
    
    const { ast, typeRegistry } = parseCode(code);
    expect(ast).toBeDefined();
    expect(typeRegistry).toHaveLength(2);
    
    const result = analyze({ ast, typeRegistry });
    expect(result.typeRegistry).toBeDefined();
    
    const output = generate(ast, typeRegistry, 'development');
    expect(output).toBeDefined();
    expect(typeof output).toBe('string');
  });

  test('handles interfaces correctly', () => {
    const code = `
      interface User {
        name: string;
      }
      let user: User = { name: "John" };
    `;
    
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    const output = generate(ast, typeRegistry, 'production');
    
    expect(output).not.toContain('interface');
  });
});

describe('Integration - Real World Code', () => {
  test('REST API handler compiles', () => {
    const code = `
      interface Request {
        method: string;
        url: string;
      }
      
      interface Response {
        status: number;
        data: any;
      }
      
      function handleRequest(req: Request): Response {
        if (req.method === "GET") {
          return { status: 200, data: { message: "OK" } };
        }
        return { status: 404, data: null };
      }
    `;
    
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    expect(result.typeRegistry.length).toBeGreaterThan(0);
    
    const devOutput = generate(ast, typeRegistry, 'development');
    const prodOutput = generate(ast, typeRegistry, 'production');
    
    expect(prodOutput).not.toContain('interface');
    expect(devOutput.length).toBeGreaterThan(prodOutput.length);
  });

  test('complex types work', () => {
    const code = `
      type ID = string | number;
      let userId: ID = 123;
    `;
    
    const { ast, typeRegistry } = parseCode(code);
    const output = generate(ast, typeRegistry, 'production');
    
    expect(output).not.toContain('type ID');
    expect(output).toContain('let userId = 123');
  });
});
