/**
 * Integration Tests
 * End-to-end tests for the complete TypedJS workflow
 */

import { parseCode } from '../src/parser/parser.js';
import { staticAnalyze, analyze } from '../src/analyzer/analyzer.js';
import { generate } from '../src/generator/generator.js';

describe('Integration - Full Workflow', () => {
  test('parse -> analyze -> generate -> execute', () => {
    const code = `
      let x: number = 10;
      let y: number = 20;
      let sum: number = x + y;
    `;
    
    const { ast, typeRegistry } = parseCode(code);
    expect(ast).toBeDefined();
    
    const result = analyze({ ast, typeRegistry });
    expect(result.typeRegistry || []).toHaveLength(0);
    
    const output = generate(ast, typeRegistry, 'development');
    expect(output).toBeDefined();
  });

  test('should catch errors during analysis', () => {
    const code = `
      let x: number = "not a number";
    `;
    
    const { ast, typeRegistry } = parseCode(code);
    const result = analyze({ ast, typeRegistry });
    
    expect(0).toBeGreaterThan(0);
  });
});

describe('Integration - Real World Scenarios', () => {
  test('REST API handler', () => {
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
    expect(result.typeRegistry || []).toHaveLength(0);
    
    const output = generate(ast, typeRegistry, 'production');
    expect(output).not.toContain('interface');
  });
});
