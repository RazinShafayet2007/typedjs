// Extended src/generator/generator.js - Full TypeScript type runtime checks

import { Parser } from 'acorn';
import escodegen from 'escodegen';
import { walk } from 'estree-walker';
import { compileCheck } from './compiler.js';

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



  let returnCounter = 0;

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
          .flatMap(p => { // Use flatMap because compileCheck returns multiple statements potentially
            const varName = p.name.replace(/^\.\.\./, '');
            // Ensure the parameter is renamed to __arg_name
            const argName = `__arg_${varName}`;

            // Generate the check code
            // Note: p.type is the Type Object from the parser (kind: 'number', etc)
            const checkCode = compileCheck(argName, p.type, mode, varName);
            if (!checkCode.trim()) return [];
            try {
              return Parser.parse(checkCode, { ecmaVersion: 2020 }).body;
            } catch (e) {
              throw new Error(`Failed to parse compiled check: ${checkCode}`);
            }
          });

        node.params = node.params.map((param, i) => {
          if (params[i] && !params[i].isThis) {
            // ... existing renaming logic ...
            if (param.type === 'RestElement') {
              param.argument.name = `__arg_${param.argument.name}`;
            } else if (param.name !== 'this') {
              param.name = `__arg_${param.name}`;
            }
          }
          return param;
        });

        // Add variable restoration (const x = __arg_x) IF we want?
        // Actually, if we rename params to __arg_x, we should probably 
        // declare `const x = __arg_x` to keep original function body working without modification?
        // Wait, the previous logic did:
        /*
            type: 'VariableDeclaration',
            declarations: [{
              id: { name: 'x' },
              init: createCheckCall('x', {name: '__arg_x'}, type)
            }]
        */
        // This effectively did `const x = check('x', __arg_x, ...)`
        // So `x` was the checked value.
        // We need to maintain this: `const x = __arg_x;` AND then `check(__arg_x)`?
        // OR `check(__arg_x); const x = __arg_x;`?

        // Let's do:
        // 1. Rename param to __arg_x
        // 2. Generate checks for __arg_x
        // 3. Declare const x = __arg_x

        const restoreStmts = params
          .filter(p => !p.isThis)
          .map(p => {
            const varName = p.name.replace(/^\.\.\./, '');
            return {
              type: 'VariableDeclaration',
              kind: 'const',
              declarations: [{
                type: 'VariableDeclarator',
                id: { type: 'Identifier', name: varName },
                init: { type: 'Identifier', name: `__arg_${varName}` }
              }]
            };
          });

        node.body.body = [...checkStmts, ...restoreStmts, ...node.body.body];


      }
    },
    leave(node, parent) {
      if (node.type === 'ReturnStatement' && parent?.type === 'BlockStatement' && parent.parent?.type === 'FunctionDeclaration' && parent.parent.id) {
        const funcName = parent.parent.id.name;
        const returnType = funcTypes[funcName]?.returnType;
        if (returnType && returnType !== 'any' && node.argument) {
          const retName = `__ret_${returnCounter++}`;
          const retDecl = {
            type: 'VariableDeclaration',
            kind: 'const',
            declarations: [{
              type: 'VariableDeclarator',
              id: { type: 'Identifier', name: retName },
              init: node.argument
            }]
          };
          const checkCode = compileCheck(retName, returnType, mode, 'Return value');
          const checkAst = checkCode.trim() ? Parser.parse(checkCode, { ecmaVersion: 2020 }).body : [];
          const retStmt = {
            type: 'ReturnStatement',
            argument: { type: 'Identifier', name: retName }
          };
          const idx = parent.body.indexOf(node);
          if (idx !== -1) {
            parent.body.splice(idx, 1, retDecl, ...checkAst, retStmt);
          }
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
const __TPJS_MODE__ = "${mode}";
const __TPJS_COLORS__ = {
  reset: "\\x1b[0m",
  yellow: "\\x1b[33m",
  red: "\\x1b[31m",
  bold: "\\x1b[1m"
};

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

function __handleCheckError__(name, expected, actual) {
  const message = name + ' expected ' + expected + ', got ' + actual;
  
  if (__TPJS_MODE__ === 'production' || __TPJS_MODE__ === 'strict') {
     throw new TypeError('[TypedJS] ' + message);
  } else {
     // Development: Warning (non-blocking)
     console.error(
       __TPJS_COLORS__.yellow + '[Type warning]' + __TPJS_COLORS__.reset + ' ' + message
     );
  }
}

function __checkUnion__(value, type) {
  return type.types.some(member => __matchesType__(value, member));
}

function __matchesType__(value, type) {
  if (!type) return true;
  if (typeof type === 'string') {
      if (type === 'any' || type === 'unknown') return true;
      if (type === 'void') return value === undefined;
      if (type === 'never') return false;
      if (type === 'null') return value === null;
      if (type === 'undefined') return value === undefined;
      if (type === 'object') return typeof value === 'object' && value !== null;
      if (type === 'array') return Array.isArray(value);
      return typeof value === type;
  }
  if (type.kind === 'literal') return value === type.value;
  if (type.kind === 'optional') {
     if (value === undefined) return true;
     return __matchesType__(value, type.type);
  }
  if (type.kind === 'union') return type.types.some(t => __matchesType__(value, t));
  if (type.kind === 'intersection') return type.types.every(t => __matchesType__(value, t));
  if (typeof type === 'object' && type !== null && !Array.isArray(type) && !type.kind) {
     if (typeof value !== 'object' || value === null) return false;
     return Object.entries(type)
       .filter(([k]) => !k.startsWith('__'))
       .every(([k, t]) => __matchesType__(value[k], t));
  }
  if (type.kind === 'object') {
     if (typeof value !== 'object' || value === null) return false;
     if (!type.properties) return true;
     return Object.entries(type.properties).every(([k, t]) => __matchesType__(value[k], t));
  }
  if (type.kind === 'enumRef') {
     return Object.values(type.values || {}).includes(value);
  }
  if (type.kind === 'array') {
     if (!Array.isArray(value)) return false;
     return value.every(v => __matchesType__(v, type.elementType));
  }
  if (type.kind === 'readonlyArray') {
     if (!Array.isArray(value)) return false;
     return value.every(v => __matchesType__(v, type.elementType));
  }
  if (type.kind === 'tuple') {
     if (!Array.isArray(value)) return false;
     return (type.elements || []).every((el, i) => {
        if (el?.kind === 'rest') return value.slice(i).every(v => __matchesType__(v, el.type));
        const elemType = el?.type || el;
        if (el?.kind === 'optionalElement' || el?.optional) {
           if (value.length <= i) return true;
           return __matchesType__(value[i], elemType);
        }
        return __matchesType__(value[i], elemType);
     });
  }
  if (type.kind === 'record') {
     if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
     return Object.values(value).every(v => __matchesType__(v, type.valueType));
  }
  if (type.kind === 'map') {
     if (!(value instanceof Map)) return false;
     for (const [k, v] of value.entries()) {
       if (!__matchesType__(k, type.keyType)) return false;
       if (!__matchesType__(v, type.valueType)) return false;
     }
     return true;
  }
  if (type.kind === 'set') {
     if (!(value instanceof Set)) return false;
     for (const v of value.values()) {
       if (!__matchesType__(v, type.elementType)) return false;
     }
     return true;
  }
  return true; 
}

function __valueStr__(value) {
  try {
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  } catch (e) {
    return String(value);
  }
}

// ===== End TypedJS Runtime Helpers =====
`;

  return `${helpers}\n${enumDefs}\n${transformed}`;
}
