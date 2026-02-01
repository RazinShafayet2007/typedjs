// Extended src/generator/generator.js - Full TypeScript type runtime checks

import escodegen from 'escodegen';
import { walk } from 'estree-walker';

function transformAst(ast, typeRegistry, mode) {
  // Remove compile-time TS nodes
  if (ast.body) {
    ast.body = ast.body.filter(node =>
      node.type !== 'TSInterfaceDeclaration' &&
      node.type !== 'TSTypeAliasDeclaration' &&
      node.type !== 'TSEnumDeclaration'
    );
  }

  // Strip TypeScript-specific properties from all nodes
  walk(ast, {
    enter(node) {
      // Remove type annotations
      if (node.typeAnnotation) node.typeAnnotation = null;
      if (node.returnType) node.returnType = null;
      if (node.typeParameters) node.typeParameters = null;

      // Clean up class-specific TS properties
      if (node.accessibility) delete node.accessibility;
      if (node.readonly !== undefined) delete node.readonly;
      if (node.abstract !== undefined) delete node.abstract;
      if (node.override !== undefined) delete node.override;
      if (node.optional !== undefined && node.type !== 'Property') delete node.optional;
      if (node.declare !== undefined) delete node.declare;
      if (node.definite !== undefined) delete node.definite;

      // Clean up implements/superTypeParameters on classes
      if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        if (node.implements) delete node.implements;
        if (node.superTypeParameters) delete node.superTypeParameters;
        if (node.typeParameters) delete node.typeParameters;
      }

      // Handle PropertyDefinition (class fields)
      if (node.type === 'PropertyDefinition') {
        if (node.accessibility) delete node.accessibility;
        if (node.readonly !== undefined) delete node.readonly;
        if (node.abstract !== undefined) delete node.abstract;
        if (node.override !== undefined) delete node.override;
        if (node.optional !== undefined) delete node.optional;
        if (node.declare !== undefined) delete node.declare;
        if (node.definite !== undefined) delete node.definite;
      }

      // Handle method definitions
      if (node.type === 'MethodDefinition') {
        if (node.accessibility) delete node.accessibility;
        if (node.abstract !== undefined) delete node.abstract;
        if (node.override !== undefined) delete node.override;
        if (node.optional !== undefined) delete node.optional;
      }

      // Clean function value inside methods
      if (node.value && (node.value.type === 'FunctionExpression' || node.value.type === 'ArrowFunctionExpression')) {
        if (node.value.returnType) node.value.returnType = null;
        if (node.value.typeParameters) node.value.typeParameters = null;
      }

      // Clean parameters
      if (node.params) {
        node.params = node.params.filter(p => {
          // Remove 'this' parameter (TypeScript only)
          if (p.type === 'Identifier' && p.name === 'this') return false;
          return true;
        });

        node.params.forEach(p => {
          if (p.typeAnnotation) p.typeAnnotation = null;
          if (p.optional !== undefined) delete p.optional;
          // Handle parameter properties
          if (p.accessibility) delete p.accessibility;
          if (p.readonly !== undefined) delete p.readonly;
        });
      }
    }
  });

  // If production mode, stop here! (No runtime checks)
  if (mode === 'production') {
    return ast;
  }

  // Helpers for check injection
  function createCheckCall(name, valueExpr, type) {
    return {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: '__checkType__' },
      arguments: [
        { type: 'Literal', value: name },
        valueExpr,
        { type: 'Literal', value: JSON.stringify(type) }
      ]
    };
  }

  function createReturnCheckCall(valueExpr, type) {
    return {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: '__checkReturnType__' },
      arguments: [
        valueExpr,
        { type: 'Literal', value: JSON.stringify(type) }
      ]
    };
  }

  const funcTypes = {};
  typeRegistry.forEach(entry => {
    if (entry.kind === 'function') {
      funcTypes[entry.name] = entry;
    }
  });

  walk(ast, {
    enter(node) {
      if (node.type === 'FunctionDeclaration' && node.id && funcTypes[node.id.name]?.params?.length > 0) {
        const params = funcTypes[node.id.name].params;
        const checkStmts = params
          .filter(p => !p.isThis) // Skip 'this' parameter
          .map(p => ({
            type: 'VariableDeclaration',
            kind: 'const',
            declarations: [{
              type: 'VariableDeclarator',
              id: { type: 'Identifier', name: p.name.replace(/^\.\.\./, '') },
              init: createCheckCall(p.name, { type: 'Identifier', name: `__arg_${p.name.replace(/^\.\.\./, '')}` }, p.type)
            }]
          }));

        node.params = node.params.map((param, i) => {
          if (params[i] && !params[i].isThis) {
            if (param.type === 'RestElement') {
              param.argument.name = `__arg_${param.argument.name}`;
            } else if (param.name !== 'this') {
              param.name = `__arg_${param.name}`;
            }
          }
          return param;
        });

        node.body.body = [...checkStmts, ...node.body.body];
      }
    },
    leave(node, parent) {
      if (node.type === 'ReturnStatement' && parent?.type === 'BlockStatement' && parent.parent?.type === 'FunctionDeclaration' && parent.parent.id) {
        const funcName = parent.parent.id.name;
        const returnType = funcTypes[funcName]?.returnType;
        if (returnType && returnType !== 'any' && node.argument) {
          node.argument = createReturnCheckCall(node.argument, returnType);
        }
      }
    }
  });

  return ast;
}

export function generate(ast, typeRegistry, mode = 'development') {
  const transformedAst = transformAst(ast, typeRegistry, mode);

  let transformed = escodegen.generate(transformedAst, {
    format: { indent: { style: '  ' } },
    comment: true,
  });

  if (mode === 'production') {
    return transformed;
  }

  // Generate enum runtime objects
  const enumDefs = typeRegistry
    .filter(e => e.kind === 'enum')
    .map(e => {
      const entries = Object.entries(e.members)
        .map(([k, v]) => `  ${k}: ${typeof v === 'string' ? JSON.stringify(v) : v}`);
      return `const ${e.name} = {\n${entries.join(',\n')}\n};`;
    })
    .join('\n\n');

  const helpers = `
// ===== TypedJS Runtime Helpers =====

function typeToString(t) {
  if (!t) return 'unknown';
  if (Array.isArray(t)) return t.map(typeToString).join(' | ');
  if (typeof t === 'string') return t;
  
  if (typeof t === 'object' && t !== null) {
    if (t.kind === 'literal') return JSON.stringify(t.value);
    if (t.kind === 'union') return t.types.map(typeToString).join(' | ');
    if (t.kind === 'intersection') return '(' + t.types.map(typeToString).join(' & ') + ')';
    if (t.kind === 'array') return 'Array<' + typeToString(t.elementType) + '>';
    if (t.kind === 'readonlyArray') return 'ReadonlyArray<' + typeToString(t.elementType) + '>';
    if (t.kind === 'map') return 'Map<' + typeToString(t.keyType) + ', ' + typeToString(t.valueType) + '>';
    if (t.kind === 'set') return 'Set<' + typeToString(t.elementType) + '>';
    if (t.kind === 'tuple') {
      const els = t.elements.map(e => {
        if (e?.kind === 'optionalElement') return typeToString(e.type) + '?';
        if (e?.kind === 'rest') return '...' + typeToString(e.type);
        if (e?.kind === 'labeled') return e.label + ': ' + typeToString(e.type);
        return typeToString(e);
      });
      return '[' + els.join(', ') + ']';
    }
    if (t.kind === 'optional') return typeToString(t.type) + '?';
    if (t.kind === 'record') return 'Record<' + typeToString(t.keyType) + ', ' + typeToString(t.valueType) + '>';
    if (t.kind === 'enumRef') return t.name;
    if (t.kind === 'function') {
      const params = (t.params || []).map(p => p.name + ': ' + typeToString(p.type)).join(', ');
      return '(' + params + ') => ' + typeToString(t.returnType);
    }
    if (t.kind === 'keyof') return 'keyof ' + typeToString(t.type);
    if (t.kind === 'typeof') return 'typeof ' + t.expression;
    if (t.kind === 'conditional') {
      return typeToString(t.checkType) + ' extends ' + typeToString(t.extendsType) + ' ? ' + typeToString(t.trueType) + ' : ' + typeToString(t.falseType);
    }
    if (t.kind === 'templateLiteral') {
      let result = '\`';
      for (let i = 0; i < (t.quasis || []).length; i++) {
        result += t.quasis[i] || '';
        if (i < (t.types || []).length) {
          result += '\${' + typeToString(t.types[i]) + '}';
        }
      }
      return result + '\`';
    }
    if (t.kind === 'promise') return 'Promise<' + typeToString(t.resolveType) + '>';
    if (t.kind === 'partial') return 'Partial<' + typeToString(t.type) + '>';
    if (t.kind === 'required') return 'Required<' + typeToString(t.type) + '>';
    if (t.kind === 'readonly') return 'Readonly<' + typeToString(t.type) + '>';
    
    // Object shape
    const entries = Object.entries(t)
      .filter(([k]) => !k.startsWith('__'))
      .map(([k, v]) => k + ': ' + typeToString(v));
    if (entries.length > 0) return '{' + entries.join(', ') + '}';
  }
  return String(t);
}

function __checkType__(name, value, typeJson) {
  const type = JSON.parse(typeJson);
  const typeStr = typeToString(type);

  // ===== Union Types =====
  if (type?.kind === 'union') {
    const ok = type.types.some(member => __matchesType__(value, member));
    if (!ok) {
      console.warn('[Type warning] ' + name + ' expected ' + typeStr + ', got ' + __valueStr__(value));
    }
    return value;
  }
  
  // Legacy array unions
  if (Array.isArray(type)) {
    const ok = type.some(member => __matchesType__(value, member));
    if (!ok) {
      console.warn('[Type warning] ' + name + ' expected ' + typeStr + ', got ' + __valueStr__(value));
    }
    return value;
  }

  // ===== Intersection Types =====
  if (type?.kind === 'intersection') {
    const ok = type.types.every(member => __matchesType__(value, member));
    if (!ok) {
      console.warn('[Type warning] ' + name + ' expected ' + typeStr + ', got ' + __valueStr__(value));
    }
    return value;
  }

  // ===== Literal Types =====
  if (type?.kind === 'literal') {
    if (value !== type.value) {
      console.warn('[Type warning] ' + name + ' expected ' + typeStr + ', got ' + __valueStr__(value));
    }
    return value;
  }

  // ===== Enum Reference =====
  if (type?.kind === 'enumRef') {
    const enumValues = Object.values(type.values || {});
    if (!enumValues.includes(value)) {
      console.warn('[Type warning] ' + name + ' expected enum ' + type.name + ', got ' + __valueStr__(value));
    }
    return value;
  }

  // ===== Primitive Types =====
  if (typeof type === 'string') {
    if (type === 'any' || type === 'unknown') return value;
    if (type === 'never') {
      console.warn('[Type warning] ' + name + ' has type never (should not have any value)');
      return value;
    }
    if (type === 'void') {
      if (value !== undefined) {
        console.warn('[Type warning] ' + name + ' expected void, got ' + __valueStr__(value));
      }
      return value;
    }
    
    const primitiveChecks = {
      'string': () => typeof value === 'string',
      'number': () => typeof value === 'number',
      'boolean': () => typeof value === 'boolean',
      'null': () => value === null,
      'undefined': () => value === undefined,
      'bigint': () => typeof value === 'bigint',
      'symbol': () => typeof value === 'symbol',
      'object': () => typeof value === 'object' && value !== null
    };
    
    if (primitiveChecks[type]) {
      if (!primitiveChecks[type]()) {
        console.warn('[Type warning] ' + name + ' expected ' + type + ', got ' + typeof value);
      }
      return value;
    }
  }

  // ===== Array Types =====
  if (type?.kind === 'array' || type?.kind === 'readonlyArray') {
    if (!Array.isArray(value)) {
      console.warn('[Type warning] ' + name + ' expected ' + typeStr + ', got ' + typeof value);
      return value;
    }
    value.forEach((item, i) => {
      __checkType__(name + '[' + i + ']', item, JSON.stringify(type.elementType));
    });
    return value;
  }

  // ===== Tuple Types =====
  if (type?.kind === 'tuple') {
    if (!Array.isArray(value)) {
      console.warn('[Type warning] ' + name + ' expected tuple, got ' + typeof value);
      return value;
    }
    
    let requiredCount = 0;
    type.elements.forEach(el => {
      if (el?.kind !== 'optionalElement' && el?.kind !== 'rest') requiredCount++;
    });
    
    if (value.length < requiredCount) {
      console.warn('[Type warning] ' + name + ' expected at least ' + requiredCount + ' elements, got ' + value.length);
    }
    
    for (let i = 0; i < type.elements.length; i++) {
      const el = type.elements[i];
      if (el?.kind === 'rest') {
        // Check all remaining elements against rest type
        for (let j = i; j < value.length; j++) {
          const restElType = el.type?.elementType || el.type;
          __checkType__(name + '[' + j + ']', value[j], JSON.stringify(restElType));
        }
        break;
      }
      
      const elType = el?.kind === 'optionalElement' ? el.type : 
                     el?.kind === 'labeled' ? el.type : el;
                     
      if (i < value.length) {
        __checkType__(name + '[' + i + ']', value[i], JSON.stringify(elType));
      }
    }
    return value;
  }

  // ===== Map Types =====
  if (type?.kind === 'map') {
    if (!(value instanceof Map)) {
      console.warn('[Type warning] ' + name + ' expected Map, got ' + typeof value);
      return value;
    }
    for (const [k, v] of value.entries()) {
      __checkType__(name + '.key', k, JSON.stringify(type.keyType));
      __checkType__(name + '.value', v, JSON.stringify(type.valueType));
    }
    return value;
  }

  // ===== Set Types =====
  if (type?.kind === 'set') {
    if (!(value instanceof Set)) {
      console.warn('[Type warning] ' + name + ' expected Set, got ' + typeof value);
      return value;
    }
    let i = 0;
    for (const item of value) {
      __checkType__(name + '[#' + i + ']', item, JSON.stringify(type.elementType));
      i++;
    }
    return value;
  }

  // ===== Record Types =====
  if (type?.kind === 'record') {
    if (typeof value !== 'object' || value === null) {
      console.warn('[Type warning] ' + name + ' expected Record, got ' + typeof value);
      return value;
    }
    for (const [k, v] of Object.entries(value)) {
      __checkType__(name + '["' + k + '"]', v, JSON.stringify(type.valueType));
    }
    return value;
  }

  // ===== Promise Types =====
  if (type?.kind === 'promise') {
    if (!(value instanceof Promise)) {
      console.warn('[Type warning] ' + name + ' expected Promise, got ' + typeof value);
    }
    return value;
  }
  
  // ===== Optional Types =====
  if (type?.kind === 'optional') {
    if (value === undefined) return value;
    return __checkType__(name, value, JSON.stringify(type.type));
  }

  // ===== Object Shapes =====
  if (typeof type === 'object' && type !== null) {
    if (typeof value !== 'object' || value === null) {
      console.warn('[Type warning] ' + name + ' expected object, got ' + typeof value);
      return value;
    }
    
    for (const [prop, pt] of Object.entries(type)) {
      if (prop.startsWith('__')) continue; // Skip meta properties
      
      const isOptional = pt?.kind === 'optional';
      const actualType = isOptional ? pt.type : pt;
      
      if (!(prop in value)) {
        if (!isOptional) {
          console.warn('[Type warning] ' + name + ' missing required property "' + prop + '"');
        }
        continue;
      }
      
      __checkType__(name + '.' + prop, value[prop], JSON.stringify(actualType));
    }
    
    // Check index signature if present
    if (type.__indexSignature) {
      for (const [k, v] of Object.entries(value)) {
        if (!(k in type) || k.startsWith('__')) {
          __checkType__(name + '["' + k + '"]', v, JSON.stringify(type.__indexSignature.valueType));
        }
      }
    }
    
    return value;
  }

  return value;
}

// Helper to check if a value matches a type (boolean)
function __matchesType__(value, type) {
  if (typeof type === 'string') {
    if (type === 'any' || type === 'unknown') return true;
    if (type === 'never') return false;
    if (type === 'void') return value === undefined;
    if (type === 'string') return typeof value === 'string';
    if (type === 'number') return typeof value === 'number';
    if (type === 'boolean') return typeof value === 'boolean';
    if (type === 'null') return value === null;
    if (type === 'undefined') return value === undefined;
    if (type === 'bigint') return typeof value === 'bigint';
    if (type === 'symbol') return typeof value === 'symbol';
    if (type === 'object') return typeof value === 'object' && value !== null;
    return false;
  }
  
  if (type?.kind === 'literal') return value === type.value;
  if (type?.kind === 'union') return type.types.some(t => __matchesType__(value, t));
  if (type?.kind === 'intersection') return type.types.every(t => __matchesType__(value, t));
  if (type?.kind === 'enumRef') return Object.values(type.values || {}).includes(value);
  if (type?.kind === 'array' || type?.kind === 'readonlyArray') {
    if (!Array.isArray(value)) return false;
    return value.every(item => __matchesType__(item, type.elementType));
  }
  
  // For complex types, defer to runtime check
  return true;
}

// Helper to stringify values for error messages
function __valueStr__(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'symbol') return 'symbol';
  if (typeof value === 'bigint') return value.toString() + 'n';
  if (typeof value === 'function') return 'function';
  try {
    return JSON.stringify(value);
  } catch {
    return typeof value;
  }
}

function __checkReturnType__(value, typeJson) {
  return __checkType__('return', value, typeJson);
}

// ===== End TypedJS Runtime Helpers =====
`;

  return `${helpers}\n${enumDefs}\n${transformed}`;
}