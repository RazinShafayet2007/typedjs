// Updated src/analyzer/analyzer.js - Fixed ESM import + proper walk for enclosing function (no this.parent)

import { walk } from 'estree-walker';

export function staticAnalyze(typeRegistry, ast) {
  const errors = [];

  // Helper to check if value matches type (for literals/constants)
  function matchesType(value, type) {
    if (Array.isArray(type)) { // Union
      return type.some(member => matchesType(value, member));
    }
    if (type.kind === 'literal') {
      return value === type.value;
    }
    if (typeof type === 'string') {
      if (type === 'any' || type === 'unknown') return true;
      if (type === 'string') return typeof value === 'string';
      if (type === 'number') return typeof value === 'number';
      if (type === 'boolean') return typeof value === 'boolean';
      if (type === 'null') return value === null;
      if (type === 'undefined') return value === undefined;
      if (type === 'bigint') return typeof value === 'bigint';
      if (type === 'symbol') return typeof value === 'symbol';
      return false;
    }
    // Structured types: skip static check for basic version
    return true;
  }

  // Map variable names to types
  const varTypes = {};
  typeRegistry.forEach(entry => {
    if (entry.kind === 'variable') {
      varTypes[entry.name] = entry.type;
    }
  });

  // Map function names to return types
  const funcReturnTypes = {};
  typeRegistry.forEach(entry => {
    if (entry.kind === 'function' && entry.returnType !== 'any') {
      funcReturnTypes[entry.name] = entry.returnType;
    }
  });

  let currentFuncName = null;

  walk(ast, {
    enter(node) {
      // Track current function
      if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
        currentFuncName = node.id?.name || null;
      }

      // Check variable initializer (only simple literals)
      if (node.type === 'VariableDeclarator' && node.init && varTypes[node.id.name]) {
        if (node.init.type === 'Literal' || node.init.type === 'BigIntLiteral') {
          const value = node.init.value ?? node.init.bigint; // bigint handling
          const declaredType = varTypes[node.id.name];
          if (!matchesType(value, declaredType)) {
            errors.push(`[Static type error] Variable '${node.id.name}' initializer ${JSON.stringify(value)} does not match declared type ${typeToString(declaredType)}`);
          }
        }
      }

      // Check literal return
      if (node.type === 'ReturnStatement' && node.argument && (node.argument.type === 'Literal' || node.argument.type === 'BigIntLiteral') && currentFuncName && funcReturnTypes[currentFuncName]) {
        const value = node.argument.value ?? node.argument.bigint;
        const returnType = funcReturnTypes[currentFuncName];
        if (!matchesType(value, returnType)) {
          errors.push(`[Static type error] Function '${currentFuncName}' returns ${JSON.stringify(value)} which does not match return type ${typeToString(returnType)}`);
        }
      }
    },
    leave(node) {
      // Clear current function on leave
      if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
        currentFuncName = null;
      }
    }
  });

  // Helper for nice type strings in errors (reuse from generator or simple)
  function typeToString(t) {
    if (Array.isArray(t)) return t.map(typeToString).join(' | ');
    if (typeof t === 'object' && t?.kind === 'literal') return JSON.stringify(t.value);
    return t;
  }

  // Print static errors
  if (errors.length > 0) {
    console.log('\n--- Static Type Errors ---');
    errors.forEach(err => console.log(err));
    console.log('--- End Static Errors ---\n');
  }

  return errors.length === 0;
}

export function analyze(typeRegistry) {
  return typeRegistry;
}