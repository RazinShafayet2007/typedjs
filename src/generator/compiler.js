/**
 * Compiler Module for TypedJS
 * Converts Type definitions into inline JavaScript validation code.
 */

const IDENTIFIER_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

export function compileCheck(varName, type, mode = 'development', path = '') {
  if (!type) return '';

  const pathStr = path ? JSON.stringify(path) : JSON.stringify(varName);

  // The code should assume __handleCheckError__ exists in scope.

  // String-based primitives / references (parser returns strings for many types)
  if (typeof type === 'string') {
    return compileStringType(varName, type, pathStr);
  }

  // Literal Types (e.g. "active", 123)
  if (type.kind === 'literal') {
    const val = typeof type.value === 'string' ? JSON.stringify(type.value) : type.value;
    return `if (${varName} !== ${val}) __handleCheckError__(${pathStr}, ${JSON.stringify(String(type.value))}, __valueStr__(${varName}));`;
  }

  // Optional
  if (type.kind === 'optional') {
    const inner = compileCheck(varName, type.type, mode, path);
    if (!inner.trim()) return '';
    return `if (${varName} !== undefined) { ${inner} }`;
  }

  // Array Types
  if (type.kind === 'array' || type.kind === 'readonlyArray') {
    const loopVar = `i_${Math.floor(Math.random() * 1000)}`;
    const itemCheck = compileCheck(`${varName}[${loopVar}]`, type.elementType, mode, path);
    const itemCode = itemCheck.trim() ? `\n        ${itemCheck}\n      ` : '';
    return `if (!Array.isArray(${varName})) { __handleCheckError__(${pathStr}, "Array", __valueStr__(${varName})); } else { for (let ${loopVar} = 0; ${loopVar} < ${varName}.length; ${loopVar}++) {${itemCode}} }`;
  }

  // Tuple Types
  if (type.kind === 'tuple') {
    return compileTupleCheck(varName, type, mode, pathStr, path);
  }

  // Object Types (Interfaces/Literals)
  if (type.kind === 'object' || isObjectShape(type)) {
    const shape = type.kind === 'object' ? type.properties || {} : type;
    return compileObjectCheck(varName, shape, mode, pathStr, path);
  }

  // Union Types
  if (type.kind === 'union') {
    return `if (!__checkUnion__(${varName}, ${JSON.stringify(type)})) { __handleCheckError__(${pathStr}, ${JSON.stringify(typeToString(type))}, __valueStr__(${varName})); }`;
  }

  // Intersection Types
  if (type.kind === 'intersection') {
    return type.types.map(t => compileCheck(varName, t, mode, path)).filter(Boolean).join('\n');
  }

  // Map
  if (type.kind === 'map') {
    const loopVar = `e_${Math.floor(Math.random() * 1000)}`;
    const keyCheck = compileCheck(`${loopVar}[0]`, type.keyType, mode, path);
    const valueCheck = compileCheck(`${loopVar}[1]`, type.valueType, mode, path);
    return `if (!(${varName} instanceof Map)) { __handleCheckError__(${pathStr}, "Map", __valueStr__(${varName})); } else { for (const ${loopVar} of ${varName}.entries()) { ${keyCheck} ${valueCheck} } }`;
  }

  // Set
  if (type.kind === 'set') {
    const loopVar = `v_${Math.floor(Math.random() * 1000)}`;
    const valueCheck = compileCheck(loopVar, type.elementType, mode, path);
    return `if (!(${varName} instanceof Set)) { __handleCheckError__(${pathStr}, "Set", __valueStr__(${varName})); } else { for (const ${loopVar} of ${varName}.values()) { ${valueCheck} } }`;
  }

  // Record
  if (type.kind === 'record') {
    const loopVar = `k_${Math.floor(Math.random() * 1000)}`;
    const valueCheck = compileCheck(`${varName}[${loopVar}]`, type.valueType, mode, path);
    return `if (typeof ${varName} !== 'object' || ${varName} === null || Array.isArray(${varName})) { __handleCheckError__(${pathStr}, "object", __valueStr__(${varName})); } else { for (const ${loopVar} in ${varName}) { ${valueCheck} } }`;
  }

  // Enum
  if (type.kind === 'enumRef') {
    const values = JSON.stringify(Object.values(type.values || {}));
    return `if (!${values}.includes(${varName})) { __handleCheckError__(${pathStr}, "${type.name}", __valueStr__(${varName})); }`;
  }

  // Fallback to runtime matcher for complex/erased types
  return `if (!__matchesType__(${varName}, ${JSON.stringify(type)})) { __handleCheckError__(${pathStr}, ${JSON.stringify(typeToString(type))}, __valueStr__(${varName})); }`;
}

function compileStringType(varName, type, pathStr) {
  if (type === 'any' || type === 'unknown') return '';
  if (type === 'void') return `if (${varName} !== undefined) __handleCheckError__(${pathStr}, "void", __valueStr__(${varName}));`;
  if (type === 'never') return `__handleCheckError__(${pathStr}, "never", __valueStr__(${varName}));`;
  if (type === 'null') return `if (${varName} !== null) __handleCheckError__(${pathStr}, "null", __valueStr__(${varName}));`;
  if (type === 'undefined') return `if (${varName} !== undefined) __handleCheckError__(${pathStr}, "undefined", __valueStr__(${varName}));`;
  if (type === 'object') return `if (typeof ${varName} !== 'object' || ${varName} === null) __handleCheckError__(${pathStr}, "object", __valueStr__(${varName}));`;
  if (type === 'array') return `if (!Array.isArray(${varName})) __handleCheckError__(${pathStr}, "Array", __valueStr__(${varName}));`;
  if (['string', 'number', 'boolean', 'bigint', 'symbol', 'function'].includes(type)) {
    return `if (typeof ${varName} !== '${type}') __handleCheckError__(${pathStr}, "${type}", __valueStr__(${varName}));`;
  }

  // Unknown reference/generic type: erase at runtime
  return '';
}

function compileTupleCheck(varName, type, mode, pathStr, path) {
  let checks = `if (!Array.isArray(${varName})) { __handleCheckError__(${pathStr}, "Array", __valueStr__(${varName})); } else {`;
  let index = 0;
  for (const el of type.elements || []) {
    if (el?.kind === 'rest') {
      const loopVar = `r_${Math.floor(Math.random() * 1000)}`;
      const restCheck = compileCheck(`${varName}[${loopVar}]`, el.type, mode, path);
      checks += ` for (let ${loopVar} = ${index}; ${loopVar} < ${varName}.length; ${loopVar}++) { ${restCheck} }`;
      index = null;
      break;
    }
    const isOptional = el?.kind === 'optionalElement' || el?.optional === true;
    const elemType = el?.type || el;
    const elemCheck = compileCheck(`${varName}[${index}]`, elemType, mode, path);
    if (isOptional) {
      checks += ` if (${varName}.length > ${index}) { ${elemCheck} }`;
    } else {
      checks += ` ${elemCheck}`;
    }
    index += 1;
  }
  checks += ' }';
  return checks;
}

function compileObjectCheck(varName, shape, mode, pathStr, path) {
  let checks = `if (typeof ${varName} !== 'object' || ${varName} === null || Array.isArray(${varName})) { __handleCheckError__(${pathStr}, "object", __valueStr__(${varName})); } else {`;

  for (const [propName, propType] of Object.entries(shape)) {
    if (propName.startsWith('__')) continue;
    const propAccess = IDENTIFIER_RE.test(propName)
      ? `${varName}.${propName}`
      : `${varName}[${JSON.stringify(propName)}]`;
    const inner = compileCheck(propAccess, propType, mode, `${path ? path + '.' : ''}${propName}`);
    if (!inner.trim()) continue;
    checks += ` ${inner}`;
  }

  const indexSig = shape.__indexSignature;
  if (indexSig?.valueType) {
    const loopVar = `k_${Math.floor(Math.random() * 1000)}`;
    const valueCheck = compileCheck(`${varName}[${loopVar}]`, indexSig.valueType, mode, path);
    checks += ` for (const ${loopVar} in ${varName}) { ${valueCheck} }`;
  }

  checks += ' }';
  return checks;
}

function isObjectShape(type) {
  return typeof type === 'object' && type !== null && !Array.isArray(type) && !type.kind;
}

// Helper to stringify types for error messages (compile time)
function typeToString(type) {
  if (!type) return 'unknown';
  if (typeof type === 'string') return type;
  if (type.kind === 'union') return type.types.map(typeToString).join(' | ');
  if (type.kind === 'intersection') return type.types.map(typeToString).join(' & ');
  if (type.kind === 'array') return `${typeToString(type.elementType)}[]`;
  if (type.kind === 'readonlyArray') return `ReadonlyArray<${typeToString(type.elementType)}>`;
  if (type.kind === 'literal') return JSON.stringify(type.value);
  if (type.kind === 'enumRef') return type.name;
  return type.kind || 'unknown';
}
