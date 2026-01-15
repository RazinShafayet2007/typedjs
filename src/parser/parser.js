import { Parser } from "acorn";
import ts from "acorn-typescript";
import { walk } from 'estree-walker';

/**
 * Convert a TypeScript AST type node into structured representation
 */
function tsTypeToString(typeNode, registry = []) {
  switch (typeNode.type) {
    case "TSStringKeyword":
      return "string";
    case "TSNumberKeyword":
      return "number";
    case "TSBooleanKeyword":
      return "boolean";
    case "TSLiteralType":
      return { kind: 'literal', value: typeNode.literal.value };
    case "TSTypeReference":
      const refName = typeNode.typeName.name;
      if (refName === 'Array' && typeNode.typeParameters?.params?.length > 0) {
        return { kind: 'array', elementType: tsTypeToString(typeNode.typeParameters.params[0], registry) };
      }
      if (refName === 'Map' && typeNode.typeParameters?.params?.length === 2) {
        return { kind: 'map', keyType: tsTypeToString(typeNode.typeParameters.params[0], registry), valueType: tsTypeToString(typeNode.typeParameters.params[1], registry) };
      }
      if (refName === 'Set' && typeNode.typeParameters?.params?.length > 0) {
        return { kind: 'set', elementType: tsTypeToString(typeNode.typeParameters.params[0], registry) };
      }
      const iface = registry.find(e => e.kind === 'interface' && e.name === refName);
      return iface ? { ...iface.shape } : refName;
    case "TSUnionType":
      return typeNode.types.map(t => tsTypeToString(t, registry));
    case "TSTypeLiteral":
      const shape = {};
      typeNode.members.forEach(m => {
        if (m.type === 'TSPropertySignature') {
          const name = m.key.name;
          const optional = !!m.optional;
          const propType = tsTypeToString(m.typeAnnotation.typeAnnotation, registry);
          shape[name] = optional ? { kind: 'optional', type: propType } : propType;
        }
      });
      return shape;
    case "TSTupleType":
      return { kind: 'tuple', elements: typeNode.elementTypes.map(et => tsTypeToString(et, registry)) };
    default:
      return "unknown";
  }
}

/**
 * Parse code and collect type registry
 */
export function parseCode(source) {
  const parser = Parser.extend(ts());
  const ast = parser.parse(source, { ecmaVersion: 2024, sourceType: "module" });

  const typeRegistry = [];

  // Pass 1: Interfaces + type aliases (for literal unions)
  walk(ast, {
    enter(node) {
      if (node.type === "TSInterfaceDeclaration") {
        const shape = {};
        node.body.body.forEach(m => {
          if (m.type === 'TSPropertySignature') {
            const name = m.key.name;
            const optional = !!m.optional;
            const propType = tsTypeToString(m.typeAnnotation.typeAnnotation, typeRegistry);
            shape[name] = optional ? { kind: 'optional', type: propType } : propType;
          }
        });
        typeRegistry.push({ kind: "interface", name: node.id.name, shape });
      } else if (node.type === "TSTypeAliasDeclaration") {
        const aliasType = tsTypeToString(node.typeAnnotation, typeRegistry);
        typeRegistry.push({ kind: "typeAlias", name: node.id.name, type: aliasType });
      }
    }
  });

  // Pass 2: Variables + functions (resolve aliases/refs)
  walk(ast, {
    enter(node) {
      if (node.type === "VariableDeclaration") {
        for (const decl of node.declarations) {
          if (decl.id.typeAnnotation) {
            let type = tsTypeToString(decl.id.typeAnnotation.typeAnnotation, typeRegistry);
            // Resolve type alias if reference
            if (typeof type === 'string') {
              const alias = typeRegistry.find(e => e.kind === 'typeAlias' && e.name === type);
              if (alias) type = alias.type;
            }
            typeRegistry.push({ kind: "variable", name: decl.id.name, type });
          }
        }
      } else if (node.type === "FunctionDeclaration") {
        const funcName = node.id.name;
        const params = node.params.map(p => {
          if (p.typeAnnotation) {
            let type = tsTypeToString(p.typeAnnotation.typeAnnotation, typeRegistry);
            if (typeof type === 'string') {
              const alias = typeRegistry.find(e => e.kind === 'typeAlias' && e.name === type);
              if (alias) type = alias.type;
            }
            return { name: p.name, type };
          }
          return null;
        }).filter(Boolean);

        let returnType = "any";
        if (node.returnType) {
          returnType = tsTypeToString(node.returnType.typeAnnotation, typeRegistry);
          if (typeof returnType === 'string') {
            const alias = typeRegistry.find(e => e.kind === 'typeAlias' && e.name === returnType);
            if (alias) returnType = alias.type;
          }
        }

        if (params.length > 0 || returnType !== "any") {
          typeRegistry.push({ kind: "function", name: funcName, params, returnType });
        }
      }
    }
  });

  return { ast, typeRegistry };
}