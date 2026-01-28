// Extended src/analyzer/analyzer.js - Full TypeScript type support

import { walk } from 'estree-walker';

/**
 * Static analyzer for TypeScript types
 * Supports: all primitives, void, never, any, unknown, object, literals,
 * unions, intersections, arrays, tuples, enums, index signatures
 */
export function staticAnalyze(typeRegistry, ast) {
  const errors = [];

  // Build lookup maps
  const enumDefs = {};
  typeRegistry.forEach(entry => {
    if (entry.kind === 'enum') {
      enumDefs[entry.name] = entry.members;
    }
  });

  // Helper to check if value matches type (for literals/constants)
  function matchesType(value, type) {
    if (value === undefined && type === 'undefined') return true;
    if (value === null && type === 'null') return true;

    // Handle union types (new format with kind: 'union')
    if (type?.kind === 'union') {
      return type.types.some(member => matchesType(value, member));
    }

    // Legacy array unions
    if (Array.isArray(type)) {
      return type.some(member => matchesType(value, member));
    }

    // Literal types
    if (type?.kind === 'literal') {
      return value === type.value;
    }

    // Intersection types - value must match ALL types
    if (type?.kind === 'intersection') {
      return type.types.every(member => matchesType(value, member));
    }

    // Enum reference
    if (type?.kind === 'enumRef') {
      const enumValues = Object.values(type.values);
      return enumValues.includes(value);
    }

    // Primitive string types
    if (typeof type === 'string') {
      if (type === 'any' || type === 'unknown') return true;
      if (type === 'never') return false; // never matches nothing
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

    // Array types
    if (type?.kind === 'array' || type?.kind === 'readonlyArray') {
      if (!Array.isArray(value)) return false;
      return value.every(item => matchesType(item, type.elementType));
    }

    // Tuple types
    if (type?.kind === 'tuple') {
      if (!Array.isArray(value)) return false;
      let requiredCount = 0;
      type.elements.forEach(el => {
        if (el?.kind !== 'optionalElement' && el?.kind !== 'rest') {
          requiredCount++;
        }
      });
      if (value.length < requiredCount) return false;

      for (let i = 0; i < type.elements.length; i++) {
        const el = type.elements[i];
        if (el?.kind === 'rest') {
          // Rest element - remaining values must match
          for (let j = i; j < value.length; j++) {
            if (!matchesType(value[j], el.type?.elementType || el.type)) {
              return false;
            }
          }
          break;
        }

        const elType = el?.kind === 'optionalElement' ? el.type :
          el?.kind === 'labeled' ? el.type : el;
        const isOptional = el?.kind === 'optionalElement' || el?.optional;

        if (i >= value.length) {
          return isOptional;
        }

        if (!matchesType(value[i], elType)) {
          return false;
        }
      }
      return true;
    }

    // Record types
    if (type?.kind === 'record') {
      if (typeof value !== 'object' || value === null) return false;
      for (const [k, v] of Object.entries(value)) {
        if (!matchesType(k, type.keyType)) return false;
        if (!matchesType(v, type.valueType)) return false;
      }
      return true;
    }

    // Map types
    if (type?.kind === 'map') {
      if (!(value instanceof Map)) return false;
      for (const [k, v] of value.entries()) {
        if (!matchesType(k, type.keyType)) return false;
        if (!matchesType(v, type.valueType)) return false;
      }
      return true;
    }

    // Set types
    if (type?.kind === 'set') {
      if (!(value instanceof Set)) return false;
      for (const item of value) {
        if (!matchesType(item, type.elementType)) return false;
      }
      return true;
    }

    // Object shapes - skip for now (handled separately)
    if (typeof type === 'object' && type !== null) {
      return true; // Defer to checkObject
    }

    return false;
  }

  function checkType(name, valueNode, type, errors) {
    // Skip meta properties
    if (name.startsWith('__')) return;

    // 1. Literal/BigInt Check
    if (valueNode.type === 'Literal' || valueNode.type === 'BigIntLiteral') {
      const value = valueNode.value ?? (valueNode.bigint ? BigInt(valueNode.bigint) : null);
      if (!matchesType(value, type)) {
        errors.push(`[Static type error] '${name}' got ${JSON.stringify(value)}, expected ${typeToString(type)}`);
      }
      return;
    }

    // 2. Object Check
    if (valueNode.type === 'ObjectExpression' && typeof type === 'object' && type?.kind !== 'literal') {
      checkObject(name, valueNode, type, errors);
      return;
    }

    // 3. Array Check
    if (valueNode.type === 'ArrayExpression') {
      if (type?.kind === 'array' || type?.kind === 'readonlyArray') {
        valueNode.elements.forEach((elem, i) => {
          if (elem) checkType(`${name}[${i}]`, elem, type.elementType, errors);
        });
      } else if (type?.kind === 'tuple') {
        valueNode.elements.forEach((elem, i) => {
          if (elem && type.elements[i]) {
            const elType = type.elements[i]?.kind === 'optionalElement' ? type.elements[i].type :
              type.elements[i]?.kind === 'labeled' ? type.elements[i].type : type.elements[i];
            checkType(`${name}[${i}]`, elem, elType, errors);
          }
        });
      }
      return;
    }
  }

  function checkObject(name, objectExpr, type, errors) {
    if (typeof type !== 'object' || type === null) return;

    // Handle union types - check if value matches any member
    if (type.kind === 'union') {
      // For unions, we just need to match at least one type
      // Don't produce errors here as value might match other union members
      return;
    }

    // Handle intersection types - check against all constituent types
    if (type.kind === 'intersection') {
      type.types.forEach(memberType => {
        if (typeof memberType === 'object' && memberType !== null && !memberType.kind) {
          checkObject(name, objectExpr, memberType, errors);
        }
      });
      return;
    }

    // Convert AST ObjectExpression props to a map
    const props = {};
    objectExpr.properties.forEach(p => {
      if (p.type === 'Property' && (p.key.type === 'Identifier' || p.key.type === 'Literal')) {
        const keyName = p.key.name || p.key.value;
        props[keyName] = p.value;
      }
    });

    // Check against type shape (skip if it has 'kind' - it's a special type, not an object shape)
    if (type.kind && typeof type.kind === 'string') {
      return; // Skip checking - this is a typed construct, not an object shape
    }

    for (const [key, expectedType] of Object.entries(type)) {
      // Skip metadata keys
      if (key.startsWith('__')) continue;

      const isOptional = expectedType?.kind === 'optional';
      const actualType = isOptional ? expectedType.type : expectedType;

      if (!(key in props)) {
        if (!isOptional) {
          errors.push(`[Static type error] Property '${key}' is missing in object '${name}'`);
        }
        continue;
      }

      checkType(`${name}.${key}`, props[key], actualType, errors);
    }

    // Check index signature if present
    if (type.__indexSignature) {
      for (const [key, valueNode] of Object.entries(props)) {
        if (!(key in type) || key.startsWith('__')) {
          checkType(`${name}["${key}"]`, valueNode, type.__indexSignature.valueType, errors);
        }
      }
    }
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

      // Check variable initializer
      if (node.type === 'VariableDeclarator' && node.init && varTypes[node.id.name]) {
        const declaredType = varTypes[node.id.name];

        if (node.init.type === 'Literal' || node.init.type === 'BigIntLiteral') {
          const value = node.init.value ?? (node.init.bigint ? BigInt(node.init.bigint) : null);
          if (!matchesType(value, declaredType)) {
            errors.push(`[Static type error] Variable '${node.id.name}' initializer ${JSON.stringify(value)} does not match type ${typeToString(declaredType)}`);
          }
        } else if (node.init.type === 'ObjectExpression') {
          checkObject(node.id.name, node.init, declaredType, errors);
        } else if (node.init.type === 'ArrayExpression') {
          checkType(node.id.name, node.init, declaredType, errors);
        }
      }

      // Check literal return
      if (node.type === 'ReturnStatement' && node.argument && currentFuncName && funcReturnTypes[currentFuncName]) {
        const returnType = funcReturnTypes[currentFuncName];

        if (node.argument.type === 'Literal' || node.argument.type === 'BigIntLiteral') {
          const value = node.argument.value ?? (node.argument.bigint ? BigInt(node.argument.bigint) : null);
          if (!matchesType(value, returnType)) {
            errors.push(`[Static type error] Function '${currentFuncName}' returns ${JSON.stringify(value)} which doesn't match return type ${typeToString(returnType)}`);
          }
        }

        // Void return type check
        if (returnType === 'void' && node.argument.type !== 'Identifier') {
          errors.push(`[Static type error] Function '${currentFuncName}' has void return type but returns a value`);
        }
      }

      // Check for missing return in non-void functions
      if (node.type === 'FunctionDeclaration' && currentFuncName && funcReturnTypes[currentFuncName]) {
        if (funcReturnTypes[currentFuncName] === 'never') {
          // never return type - function should not return normally
        }
      }
    },
    leave(node) {
      if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
        currentFuncName = null;
      }
    }
  });

  // Helper for nice type strings in errors
  function typeToString(t) {
    if (!t) return 'unknown';
    if (Array.isArray(t)) return t.map(typeToString).join(' | ');
    if (typeof t === 'string') return t;

    if (t.kind === 'literal') return JSON.stringify(t.value);
    if (t.kind === 'union') return t.types.map(typeToString).join(' | ');
    if (t.kind === 'intersection') return t.types.map(typeToString).join(' & ');
    if (t.kind === 'array') return `Array<${typeToString(t.elementType)}>`;
    if (t.kind === 'readonlyArray') return `ReadonlyArray<${typeToString(t.elementType)}>`;
    if (t.kind === 'tuple') return `[${t.elements.map(e => {
      if (e?.kind === 'optionalElement') return typeToString(e.type) + '?';
      if (e?.kind === 'rest') return '...' + typeToString(e.type);
      if (e?.kind === 'labeled') return `${e.label}: ${typeToString(e.type)}`;
      return typeToString(e);
    }).join(', ')}]`;
    if (t.kind === 'map') return `Map<${typeToString(t.keyType)}, ${typeToString(t.valueType)}>`;
    if (t.kind === 'set') return `Set<${typeToString(t.elementType)}>`;
    if (t.kind === 'record') return `Record<${typeToString(t.keyType)}, ${typeToString(t.valueType)}>`;
    if (t.kind === 'optional') return `${typeToString(t.type)}?`;
    if (t.kind === 'enumRef') return t.name;
    if (t.kind === 'function') {
      const params = t.params?.map(p => `${p.name}: ${typeToString(p.type)}`).join(', ') || '';
      return `(${params}) => ${typeToString(t.returnType)}`;
    }
    if (t.kind === 'conditional') {
      return `${typeToString(t.checkType)} extends ${typeToString(t.extendsType)} ? ${typeToString(t.trueType)} : ${typeToString(t.falseType)}`;
    }
    if (t.kind === 'keyof') return `keyof ${typeToString(t.type)}`;
    if (t.kind === 'typeof') return `typeof ${t.expression}`;
    if (t.kind === 'mapped') return `{ [${t.keyName} in ${typeToString(t.keyConstraint)}]: ${typeToString(t.valueType)} }`;
    if (t.kind === 'templateLiteral') {
      let result = '`';
      for (let i = 0; i < t.quasis.length; i++) {
        result += t.quasis[i];
        if (i < t.types.length) {
          result += '${' + typeToString(t.types[i]) + '}';
        }
      }
      return result + '`';
    }

    // Object shape
    if (typeof t === 'object') {
      const entries = Object.entries(t)
        .filter(([k]) => !k.startsWith('__'))
        .map(([k, v]) => `${k}: ${typeToString(v)}`);
      return `{ ${entries.join(', ')} }`;
    }

    return String(t);
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