// Updated src/generator/generator.js - Added runtime checks for null, undefined, bigint, symbol

import escodegen from 'escodegen';
import { walk } from 'estree-walker';

function transformAst(ast, typeRegistry, mode) {
  // Remove compile-time TS nodes
  if (ast.body) {
    ast.body = ast.body.filter(node => 
      node.type !== 'TSInterfaceDeclaration' &&
      node.type !== 'TSTypeAliasDeclaration'
    );
  }

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
      if (node.typeAnnotation) node.typeAnnotation = null;
      if (node.returnType) node.returnType = null;

      if (node.type === 'FunctionDeclaration' && node.id && funcTypes[node.id.name]?.params?.length > 0) {
        const params = funcTypes[node.id.name].params;
        const checkStmts = params.map(p => ({
          type: 'VariableDeclaration',
          kind: 'const',
          declarations: [{
            type: 'VariableDeclarator',
            id: { type: 'Identifier', name: p.name },
            init: createCheckCall(p.name, { type: 'Identifier', name: `__arg_${p.name}` }, p.type)
          }]
        }));

        node.params = node.params.map((param, i) => {
          if (params[i]) param.name = `__arg_${param.name}`;
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

  const helpers = `
function typeToString(t) {
  if (Array.isArray(t)) {
    return t.map(typeToString).join(' | ');
  }
  if (typeof t === 'object' && t !== null) {
    if (t.kind === 'literal') return JSON.stringify(t.value);
    if (t.kind === 'array') return 'Array<' + typeToString(t.elementType) + '>';
    if (t.kind === 'map') return 'Map<' + typeToString(t.keyType) + ', ' + typeToString(t.valueType) + '>';
    if (t.kind === 'set') return 'Set<' + typeToString(t.elementType) + '>';
    if (t.kind === 'tuple') return '[' + t.elements.map(typeToString).join(', ') + ']';
    if (t.kind === 'optional') return typeToString(t.type) + '?';
    return '{' + Object.keys(t).map(k => k + ': ' + typeToString(t[k])).join(', ') + '}';
  }
  return t;
}

function __checkType__(name, value, typeJson) {
  const type = JSON.parse(typeJson);
  const typeStr = typeToString(type);

  // Union
  if (Array.isArray(type)) {
    const ok = type.some(member => {
      if (typeof member === 'string') {
        if (member === 'string') return typeof value === 'string';
        if (member === 'number') return typeof value === 'number';
        if (member === 'boolean') return typeof value === 'boolean';
        if (member === 'null') return value === null;
        if (member === 'undefined') return value === undefined;
        if (member === 'bigint') return typeof value === 'bigint';
        if (member === 'symbol') return typeof value === 'symbol';
        if (member === 'unknown') return true;
        return false;
      }
      if (member.kind === 'literal') {
        return value === member.value;
      }
      return false;
    });
    if (!ok) {
      console.warn('[Type warning] ' + name + ' expected ' + typeStr + ', got ' + JSON.stringify(value));
    }
    return value;
  }

  // Single literal
  if (type.kind === 'literal') {
    if (value !== type.value) {
      console.warn('[Type warning] ' + name + ' expected ' + typeStr + ', got ' + JSON.stringify(value));
    }
    return value;
  }

  // Primitive (including new ones)
  if (typeof type === 'string') {
    if (type === 'any') return value;
    const allowed = type.split('|').map(s => s.trim());
    const ok = allowed.some(a => {
      if (a === 'string') return typeof value === 'string';
      if (a === 'number') return typeof value === 'number';
      if (a === 'boolean') return typeof value === 'boolean';
      if (a === 'null') return value === null;
      if (a === 'undefined') return value === undefined;
      if (a === 'bigint') return typeof value === 'bigint';
      if (a === 'symbol') return typeof value === 'symbol';
      if (a === 'unknown') return true;
      return false;
    });
    if (!ok) console.warn('[Type warning] ' + name + ' expected ' + typeStr + ', got ' + typeof value);
    return value;
  }

  // Structured types (unchanged)
  if (typeof type === 'object' && type !== null) {
    if (type.kind === 'array') {
      if (!Array.isArray(value)) {
        console.warn('[Type warning] ' + name + ' expected ' + typeStr + ', got ' + typeof value);
        return value;
      }
      value.forEach((item, i) => {
        __checkType__(name + '[' + i + ']', item, JSON.stringify(type.elementType));
      });
      return value;
    }

    if (type.kind === 'map') {
      if (!(value instanceof Map)) {
        console.warn('[Type warning] ' + name + ' expected ' + typeStr + ', got ' + typeof value);
        return value;
      }
      for (const [k, v] of value.entries()) {
        __checkType__(name + '.key', k, JSON.stringify(type.keyType));
        __checkType__(name + '.value', v, JSON.stringify(type.valueType));
      }
      return value;
    }

    if (type.kind === 'set') {
      if (!(value instanceof Set)) {
        console.warn('[Type warning] ' + name + ' expected ' + typeStr + ', got ' + typeof value);
        return value;
      }
      let i = 0;
      for (const item of value) {
        __checkType__(name + '[#' + i + ']', item, JSON.stringify(type.elementType));
        i++;
      }
      return value;
    }

    if (type.kind === 'tuple') {
      if (!Array.isArray(value)) {
        console.warn('[Type warning] ' + name + ' expected ' + typeStr + ', got ' + typeof value);
        return value;
      }
      if (value.length !== type.elements.length) {
        console.warn('[Type warning] ' + name + ' expected tuple length ' + type.elements.length + ', got ' + value.length);
      }
      type.elements.forEach((et, i) => {
        if (i < value.length) {
          __checkType__(name + '[' + i + ']', value[i], JSON.stringify(et));
        }
      });
      return value;
    }

    if (type.kind === 'optional') {
      if (value === undefined) return value;
      return __checkType__(name, value, JSON.stringify(type.type));
    }

    // Object shape
    if (typeof value !== 'object' || value === null) {
      console.warn('[Type warning] ' + name + ' expected ' + typeStr + ', got ' + typeof value);
      return value;
    }
    for (const [prop, pt] of Object.entries(type)) {
      const actualType = pt.kind === 'optional' ? pt.type : pt;
      if (pt.kind === 'optional' && value[prop] === undefined) continue;
      __checkType__(name + '.' + prop, value[prop], JSON.stringify(actualType));
    }
    return value;
  }

  return value;
}

function __checkReturnType__(value, typeJson) {
  return __checkType__('return', value, typeJson);
}
`;

  const varChecks = typeRegistry
    .filter(e => e.kind === 'variable')
    .map(({ name, type }) => `__checkType__('${name}', ${name}, ${JSON.stringify(JSON.stringify(type))});`)
    .join('\n');

  return `${helpers}\n${transformed}\n${varChecks}`;
}