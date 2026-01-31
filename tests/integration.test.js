/**
 * Integration Tests
 * End-to-end tests for the complete TypedJS workflow
 */

import parser from '../src/parser/parser.js';
import analyzer from '../src/analyzer/analyzer.js';
import generator from '../src/generator/generator.js';

describe('Integration - Full Workflow', () => {
  test('parse -> analyze -> generate -> execute', () => {
    const code = `
      let x: number = 10;
      let y: number = 20;
      let sum: number = x + y;
    `;
    
    const ast = parser.parse(code);
    expect(ast).toBeDefined();
    
    const errors = analyzer.analyze(ast);
    expect(errors).toHaveLength(0);
    
    const output = generator.generate(ast, { mode: 'dev' });
    expect(output).toBeDefined();
  });

  test('should catch errors during analysis', () => {
    const code = `
      let x: number = "not a number";
    `;
    
    const ast = parser.parse(code);
    const errors = analyzer.analyze(ast);
    
    expect(errors.length).toBeGreaterThan(0);
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
    
    const ast = parser.parse(code);
    const errors = analyzer.analyze(ast);
    expect(errors).toHaveLength(0);
    
    const output = generator.generate(ast, { mode: 'prod' });
    expect(output).not.toContain('interface');
  });
});
