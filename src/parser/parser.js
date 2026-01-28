// Extended src/parser/parser.js - Full TypeScript type support

import { Parser } from "acorn";
import ts from "acorn-typescript";
import { walk } from 'estree-walker';

/**
 * Convert a TypeScript AST type node into structured representation
 * Supports: primitives, void, never, any, unknown, object, literals,
 * unions, intersections, arrays, tuples, objects, readonly, index signatures,
 * function types, constructor types, conditional types, mapped types,
 * keyof, typeof, indexed access, template literals
 */
function tsTypeToString(typeNode, registry = []) {
  if (!typeNode) return "unknown";

  switch (typeNode.type) {
    // ===== Primitive Keywords =====
    case "TSNullKeyword":
      return "null";
    case "TSUndefinedKeyword":
      return "undefined";
    case "TSBigIntKeyword":
      return "bigint";
    case "TSSymbolKeyword":
      return "symbol";
    case "TSStringKeyword":
      return "string";
    case "TSNumberKeyword":
      return "number";
    case "TSBooleanKeyword":
      return "boolean";

    // ===== Special Primitives =====
    case "TSVoidKeyword":
      return "void";
    case "TSNeverKeyword":
      return "never";
    case "TSAnyKeyword":
      return "any";
    case "TSUnknownKeyword":
      return "unknown";
    case "TSObjectKeyword":
      return "object";

    // ===== Literal Types =====
    case "TSLiteralType":
      if (typeNode.literal.type === 'TemplateLiteral') {
        // Template literal type like `hello ${string}`
        return {
          kind: 'templateLiteral',
          quasis: typeNode.literal.quasis.map(q => q.value.raw),
          expressions: typeNode.literal.expressions.map(e => tsTypeToString(e, registry))
        };
      }
      return { kind: 'literal', value: typeNode.literal.value };

    // ===== Type Reference =====
    case "TSTypeReference": {
      const typeName = typeNode.typeName;
      const refName = typeName.type === 'Identifier' ? typeName.name :
        (typeName.left?.name + '.' + typeName.right?.name);

      // Built-in generic types
      if (refName === 'Array' && typeNode.typeParameters?.params?.length > 0) {
        return { kind: 'array', elementType: tsTypeToString(typeNode.typeParameters.params[0], registry) };
      }
      if (refName === 'ReadonlyArray' && typeNode.typeParameters?.params?.length > 0) {
        return { kind: 'readonlyArray', elementType: tsTypeToString(typeNode.typeParameters.params[0], registry) };
      }
      if (refName === 'Map' && typeNode.typeParameters?.params?.length === 2) {
        return { kind: 'map', keyType: tsTypeToString(typeNode.typeParameters.params[0], registry), valueType: tsTypeToString(typeNode.typeParameters.params[1], registry) };
      }
      if (refName === 'Set' && typeNode.typeParameters?.params?.length > 0) {
        return { kind: 'set', elementType: tsTypeToString(typeNode.typeParameters.params[0], registry) };
      }
      if (refName === 'Promise' && typeNode.typeParameters?.params?.length > 0) {
        return { kind: 'promise', resolveType: tsTypeToString(typeNode.typeParameters.params[0], registry) };
      }

      // Utility types
      if (refName === 'Partial' && typeNode.typeParameters?.params?.length > 0) {
        return { kind: 'partial', type: tsTypeToString(typeNode.typeParameters.params[0], registry) };
      }
      if (refName === 'Required' && typeNode.typeParameters?.params?.length > 0) {
        return { kind: 'required', type: tsTypeToString(typeNode.typeParameters.params[0], registry) };
      }
      if (refName === 'Readonly' && typeNode.typeParameters?.params?.length > 0) {
        return { kind: 'readonly', type: tsTypeToString(typeNode.typeParameters.params[0], registry) };
      }
      if (refName === 'Pick' && typeNode.typeParameters?.params?.length === 2) {
        return { kind: 'pick', type: tsTypeToString(typeNode.typeParameters.params[0], registry), keys: tsTypeToString(typeNode.typeParameters.params[1], registry) };
      }
      if (refName === 'Omit' && typeNode.typeParameters?.params?.length === 2) {
        return { kind: 'omit', type: tsTypeToString(typeNode.typeParameters.params[0], registry), keys: tsTypeToString(typeNode.typeParameters.params[1], registry) };
      }
      if (refName === 'Record' && typeNode.typeParameters?.params?.length === 2) {
        return { kind: 'record', keyType: tsTypeToString(typeNode.typeParameters.params[0], registry), valueType: tsTypeToString(typeNode.typeParameters.params[1], registry) };
      }
      if (refName === 'Exclude' && typeNode.typeParameters?.params?.length === 2) {
        return { kind: 'exclude', type: tsTypeToString(typeNode.typeParameters.params[0], registry), excluded: tsTypeToString(typeNode.typeParameters.params[1], registry) };
      }
      if (refName === 'Extract' && typeNode.typeParameters?.params?.length === 2) {
        return { kind: 'extract', type: tsTypeToString(typeNode.typeParameters.params[0], registry), extracted: tsTypeToString(typeNode.typeParameters.params[1], registry) };
      }
      if (refName === 'NonNullable' && typeNode.typeParameters?.params?.length > 0) {
        return { kind: 'nonNullable', type: tsTypeToString(typeNode.typeParameters.params[0], registry) };
      }
      if (refName === 'ReturnType' && typeNode.typeParameters?.params?.length > 0) {
        return { kind: 'returnType', type: tsTypeToString(typeNode.typeParameters.params[0], registry) };
      }
      if (refName === 'Parameters' && typeNode.typeParameters?.params?.length > 0) {
        return { kind: 'parameters', type: tsTypeToString(typeNode.typeParameters.params[0], registry) };
      }
      if (refName === 'Awaited' && typeNode.typeParameters?.params?.length > 0) {
        return { kind: 'awaited', type: tsTypeToString(typeNode.typeParameters.params[0], registry) };
      }

      // Generic type with parameters
      if (typeNode.typeParameters?.params?.length > 0) {
        return {
          kind: 'generic',
          name: refName,
          typeArgs: typeNode.typeParameters.params.map(p => tsTypeToString(p, registry))
        };
      }

      // Check if it's a registered interface or type alias
      const iface = registry.find(e => e.kind === 'interface' && e.name === refName);
      if (iface) return { ...iface.shape };

      const typeAlias = registry.find(e => e.kind === 'typeAlias' && e.name === refName);
      if (typeAlias) return typeAlias.type;

      // Check if it's an enum
      const enumDef = registry.find(e => e.kind === 'enum' && e.name === refName);
      if (enumDef) return { kind: 'enumRef', name: refName, values: enumDef.members };

      return refName;
    }

    // ===== Union & Intersection Types =====
    case "TSUnionType":
      return { kind: 'union', types: typeNode.types.map(t => tsTypeToString(t, registry)) };

    case "TSIntersectionType":
      return { kind: 'intersection', types: typeNode.types.map(t => tsTypeToString(t, registry)) };

    // ===== Object/Type Literal =====
    case "TSTypeLiteral": {
      const shape = { __meta: {} };
      typeNode.members.forEach(m => {
        if (m.type === 'TSPropertySignature') {
          const name = m.key.name || m.key.value;
          const optional = !!m.optional;
          const readonly = !!m.readonly;
          const propType = tsTypeToString(m.typeAnnotation?.typeAnnotation, registry);

          let finalType = propType;
          if (optional) finalType = { kind: 'optional', type: propType };
          if (readonly) {
            shape.__meta[name] = { readonly: true };
          }
          shape[name] = finalType;
        } else if (m.type === 'TSIndexSignature') {
          // Index signature like [key: string]: T
          const indexParam = m.parameters[0];
          const keyType = tsTypeToString(indexParam.typeAnnotation?.typeAnnotation, registry);
          const valueType = tsTypeToString(m.typeAnnotation?.typeAnnotation, registry);
          shape.__indexSignature = { keyType, valueType };
        } else if (m.type === 'TSCallSignatureDeclaration') {
          // Callable: { (x: number): string }
          const params = m.params?.map(p => ({
            name: p.name,
            type: tsTypeToString(p.typeAnnotation?.typeAnnotation, registry)
          })) || [];
          const returnType = tsTypeToString(m.typeAnnotation?.typeAnnotation, registry);
          shape.__callSignature = { params, returnType };
        } else if (m.type === 'TSConstructSignatureDeclaration') {
          // Constructor: { new (x: number): Foo }
          const params = m.params?.map(p => ({
            name: p.name,
            type: tsTypeToString(p.typeAnnotation?.typeAnnotation, registry)
          })) || [];
          const returnType = tsTypeToString(m.typeAnnotation?.typeAnnotation, registry);
          shape.__constructSignature = { params, returnType };
        } else if (m.type === 'TSMethodSignature') {
          const name = m.key.name || m.key.value;
          const params = m.params?.map(p => ({
            name: p.name,
            type: tsTypeToString(p.typeAnnotation?.typeAnnotation, registry)
          })) || [];
          const returnType = tsTypeToString(m.typeAnnotation?.typeAnnotation, registry);
          shape[name] = { kind: 'method', params, returnType };
        }
      });

      // Clean up empty __meta
      if (Object.keys(shape.__meta).length === 0) delete shape.__meta;

      return shape;
    }

    // ===== Tuple Types =====
    case "TSTupleType": {
      const elements = typeNode.elementTypes.map(et => {
        // Check for labeled tuple elements
        if (et.type === 'TSNamedTupleMember') {
          return {
            kind: 'labeled',
            label: et.label?.name,
            optional: !!et.optional,
            type: tsTypeToString(et.elementType, registry)
          };
        }
        // Check for rest element
        if (et.type === 'TSRestType') {
          return {
            kind: 'rest',
            type: tsTypeToString(et.typeAnnotation, registry)
          };
        }
        // Check for optional element
        if (et.type === 'TSOptionalType') {
          return {
            kind: 'optionalElement',
            type: tsTypeToString(et.typeAnnotation, registry)
          };
        }
        return tsTypeToString(et, registry);
      });

      return {
        kind: 'tuple',
        elements,
        readonly: false
      };
    }

    // ===== Array Types =====
    case "TSArrayType":
      return { kind: 'array', elementType: tsTypeToString(typeNode.elementType, registry) };

    // ===== Function Types =====
    case "TSFunctionType": {
      const typeParams = typeNode.typeParameters?.params?.map(tp => ({
        name: tp.name,
        constraint: tp.constraint ? tsTypeToString(tp.constraint, registry) : null,
        default: tp.default ? tsTypeToString(tp.default, registry) : null
      })) || [];

      const params = typeNode.params?.map(p => {
        const paramName = p.type === 'Identifier' ? p.name :
          (p.type === 'RestElement' ? '...' + p.argument.name : 'param');
        return {
          name: paramName,
          type: tsTypeToString(p.typeAnnotation?.typeAnnotation, registry),
          optional: !!p.optional
        };
      }) || [];

      const returnType = tsTypeToString(typeNode.typeAnnotation?.typeAnnotation, registry);

      return { kind: 'function', typeParams, params, returnType };
    }

    // ===== Constructor Types =====
    case "TSConstructorType": {
      const params = typeNode.params?.map(p => ({
        name: p.name,
        type: tsTypeToString(p.typeAnnotation?.typeAnnotation, registry)
      })) || [];
      const returnType = tsTypeToString(typeNode.typeAnnotation?.typeAnnotation, registry);

      return { kind: 'constructor', params, returnType };
    }

    // ===== Type Operators (keyof, typeof, readonly) =====
    case "TSTypeOperator":
      if (typeNode.operator === 'keyof') {
        return { kind: 'keyof', type: tsTypeToString(typeNode.typeAnnotation, registry) };
      }
      if (typeNode.operator === 'typeof') {
        return { kind: 'typeof', expression: typeNode.typeAnnotation?.typeName?.name || 'unknown' };
      }
      if (typeNode.operator === 'readonly') {
        const innerType = tsTypeToString(typeNode.typeAnnotation, registry);
        if (innerType.kind === 'tuple') {
          return { ...innerType, readonly: true };
        }
        if (innerType.kind === 'array') {
          return { kind: 'readonlyArray', elementType: innerType.elementType };
        }
        return { kind: 'readonly', type: innerType };
      }
      return "unknown";

    // ===== Indexed Access Types =====
    case "TSIndexedAccessType":
      return {
        kind: 'indexedAccess',
        objectType: tsTypeToString(typeNode.objectType, registry),
        indexType: tsTypeToString(typeNode.indexType, registry)
      };

    // ===== Conditional Types =====
    case "TSConditionalType":
      return {
        kind: 'conditional',
        checkType: tsTypeToString(typeNode.checkType, registry),
        extendsType: tsTypeToString(typeNode.extendsType, registry),
        trueType: tsTypeToString(typeNode.trueType, registry),
        falseType: tsTypeToString(typeNode.falseType, registry)
      };

    // ===== Infer Type =====
    case "TSInferType":
      return { kind: 'infer', name: typeNode.typeParameter?.name };

    // ===== Mapped Types =====
    case "TSMappedType": {
      const typeParam = typeNode.typeParameter;
      return {
        kind: 'mapped',
        keyName: typeParam?.name,
        keyConstraint: tsTypeToString(typeParam?.constraint, registry),
        nameType: typeNode.nameType ? tsTypeToString(typeNode.nameType, registry) : null,
        valueType: tsTypeToString(typeNode.typeAnnotation, registry),
        readonly: typeNode.readonly ? (typeNode.readonly === '+' ? 'add' : (typeNode.readonly === '-' ? 'remove' : true)) : false,
        optional: typeNode.optional ? (typeNode.optional === '+' ? 'add' : (typeNode.optional === '-' ? 'remove' : true)) : false
      };
    }

    // ===== Template Literal Types =====
    case "TSTemplateLiteralType":
      return {
        kind: 'templateLiteral',
        quasis: typeNode.quasis?.map(q => q.value?.raw || '') || [],
        types: typeNode.types?.map(t => tsTypeToString(t, registry)) || []
      };

    // ===== Type Query (typeof for expressions) =====
    case "TSTypeQuery":
      return {
        kind: 'typeof',
        expression: typeNode.exprName?.name ||
          (typeNode.exprName?.left?.name + '.' + typeNode.exprName?.right?.name)
      };

    // ===== Parenthesized Type =====
    case "TSParenthesizedType":
      return tsTypeToString(typeNode.typeAnnotation, registry);

    // ===== Rest Type =====
    case "TSRestType":
      return { kind: 'rest', type: tsTypeToString(typeNode.typeAnnotation, registry) };

    // ===== Optional Type =====
    case "TSOptionalType":
      return { kind: 'optionalElement', type: tsTypeToString(typeNode.typeAnnotation, registry) };

    // ===== This Type =====
    case "TSThisType":
      return "this";

    // ===== Import Type =====
    case "TSImportType":
      return {
        kind: 'import',
        argument: typeNode.argument?.value,
        qualifier: typeNode.qualifier?.name
      };

    default:
      return "unknown";
  }
}


/**
 * Parse code and collect type registry
 * Extended to handle: enums, extended interfaces, class declarations
 */
export function parseCode(source) {
  const parser = Parser.extend(ts());
  const ast = parser.parse(source, { ecmaVersion: 2024, sourceType: "module" });

  const typeRegistry = [];

  // Pass 1: Enums, Interfaces, Type Aliases (collect definitions first)
  walk(ast, {
    enter(node) {
      // ===== Enum Declarations =====
      if (node.type === "TSEnumDeclaration") {
        const members = {};
        let autoValue = 0;

        node.members.forEach(m => {
          const name = m.id.name || m.id.value;
          if (m.initializer) {
            if (m.initializer.type === 'Literal') {
              members[name] = m.initializer.value;
              if (typeof m.initializer.value === 'number') {
                autoValue = m.initializer.value + 1;
              }
            } else if (m.initializer.type === 'UnaryExpression' && m.initializer.operator === '-') {
              members[name] = -m.initializer.argument.value;
              autoValue = members[name] + 1;
            }
          } else {
            members[name] = autoValue++;
          }
        });

        typeRegistry.push({
          kind: "enum",
          name: node.id.name,
          members,
          isConst: !!node.const
        });
      }

      // ===== Interface Declarations =====
      else if (node.type === "TSInterfaceDeclaration") {
        const shape = { __meta: {} };

        // Handle extends
        if (node.extends?.length > 0) {
          shape.__extends = node.extends.map(ext => ext.expression?.name || ext.name);
        }

        node.body.body.forEach(m => {
          if (m.type === 'TSPropertySignature') {
            const name = m.key.name || m.key.value;
            const optional = !!m.optional;
            const readonly = !!m.readonly;
            const propType = tsTypeToString(m.typeAnnotation?.typeAnnotation, typeRegistry);

            let finalType = propType;
            if (optional) finalType = { kind: 'optional', type: propType };
            if (readonly) {
              shape.__meta[name] = { readonly: true };
            }
            shape[name] = finalType;
          } else if (m.type === 'TSIndexSignature') {
            const indexParam = m.parameters[0];
            const keyType = tsTypeToString(indexParam.typeAnnotation?.typeAnnotation, typeRegistry);
            const valueType = tsTypeToString(m.typeAnnotation?.typeAnnotation, typeRegistry);
            shape.__indexSignature = { keyType, valueType, readonly: !!m.readonly };
          } else if (m.type === 'TSCallSignatureDeclaration') {
            const params = m.params?.map(p => ({
              name: p.name,
              type: tsTypeToString(p.typeAnnotation?.typeAnnotation, typeRegistry)
            })) || [];
            const returnType = tsTypeToString(m.typeAnnotation?.typeAnnotation, typeRegistry);
            shape.__callSignature = { params, returnType };
          } else if (m.type === 'TSConstructSignatureDeclaration') {
            const params = m.params?.map(p => ({
              name: p.name,
              type: tsTypeToString(p.typeAnnotation?.typeAnnotation, typeRegistry)
            })) || [];
            const returnType = tsTypeToString(m.typeAnnotation?.typeAnnotation, typeRegistry);
            shape.__constructSignature = { params, returnType };
          } else if (m.type === 'TSMethodSignature') {
            const name = m.key.name || m.key.value;
            const params = m.params?.map(p => ({
              name: p.name,
              type: tsTypeToString(p.typeAnnotation?.typeAnnotation, typeRegistry),
              optional: !!p.optional
            })) || [];
            const returnType = tsTypeToString(m.typeAnnotation?.typeAnnotation, typeRegistry);
            shape[name] = { kind: 'method', params, returnType, optional: !!m.optional };
          }
        });

        // Clean up empty __meta
        if (Object.keys(shape.__meta).length === 0) delete shape.__meta;

        typeRegistry.push({ kind: "interface", name: node.id.name, shape });
      }

      // ===== Type Alias Declarations =====
      else if (node.type === "TSTypeAliasDeclaration") {
        const typeParams = node.typeParameters?.params?.map(tp => ({
          name: tp.name,
          constraint: tp.constraint ? tsTypeToString(tp.constraint, typeRegistry) : null,
          default: tp.default ? tsTypeToString(tp.default, typeRegistry) : null
        })) || [];

        const aliasType = tsTypeToString(node.typeAnnotation, typeRegistry);
        typeRegistry.push({
          kind: "typeAlias",
          name: node.id.name,
          type: aliasType,
          typeParams: typeParams.length > 0 ? typeParams : undefined
        });
      }
    }
  });

  // Pass 2: Variables, Functions, Classes (resolve aliases)
  walk(ast, {
    enter(node) {
      // ===== Variable Declarations =====
      if (node.type === "VariableDeclaration") {
        for (const decl of node.declarations) {
          if (decl.id.typeAnnotation) {
            let type = tsTypeToString(decl.id.typeAnnotation.typeAnnotation, typeRegistry);
            if (typeof type === 'string') {
              const alias = typeRegistry.find(e => e.kind === 'typeAlias' && e.name === type);
              if (alias) type = alias.type;
            }

            // Check for as const
            const isConst = decl.init?.type === 'TSAsExpression' &&
              decl.init.typeAnnotation?.type === 'TSTypeReference' &&
              decl.init.typeAnnotation.typeName?.name === 'const';

            typeRegistry.push({
              kind: "variable",
              name: decl.id.name,
              type,
              isConst: isConst || node.kind === 'const'
            });
          }
        }
      }

      // ===== Function Declarations =====
      else if (node.type === "FunctionDeclaration") {
        const funcName = node.id?.name;
        if (!funcName) return;

        const typeParams = node.typeParameters?.params?.map(tp => ({
          name: tp.name,
          constraint: tp.constraint ? tsTypeToString(tp.constraint, typeRegistry) : null,
          default: tp.default ? tsTypeToString(tp.default, typeRegistry) : null
        })) || [];

        const params = node.params.map(p => {
          // Handle rest parameters
          if (p.type === 'RestElement') {
            return {
              name: '...' + (p.argument?.name || 'rest'),
              type: tsTypeToString(p.argument?.typeAnnotation?.typeAnnotation || p.typeAnnotation?.typeAnnotation, typeRegistry),
              rest: true
            };
          }

          // Handle this parameter
          if (p.type === 'Identifier' && p.name === 'this') {
            return {
              name: 'this',
              type: tsTypeToString(p.typeAnnotation?.typeAnnotation, typeRegistry),
              isThis: true
            };
          }

          if (p.typeAnnotation) {
            let type = tsTypeToString(p.typeAnnotation.typeAnnotation, typeRegistry);
            if (typeof type === 'string') {
              const alias = typeRegistry.find(e => e.kind === 'typeAlias' && e.name === type);
              if (alias) type = alias.type;
            }
            return { name: p.name, type, optional: !!p.optional };
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

        if (params.length > 0 || returnType !== "any" || typeParams.length > 0) {
          typeRegistry.push({
            kind: "function",
            name: funcName,
            params,
            returnType,
            typeParams: typeParams.length > 0 ? typeParams : undefined,
            async: !!node.async,
            generator: !!node.generator
          });
        }
      }

      // ===== Class Declarations =====
      else if (node.type === "ClassDeclaration") {
        const className = node.id?.name;
        if (!className) return;

        const classInfo = {
          kind: "class",
          name: className,
          typeParams: node.typeParameters?.params?.map(tp => ({
            name: tp.name,
            constraint: tp.constraint ? tsTypeToString(tp.constraint, typeRegistry) : null,
            default: tp.default ? tsTypeToString(tp.default, typeRegistry) : null
          })) || [],
          extends: node.superClass?.name || null,
          implements: node.implements?.map(impl => impl.expression?.name || impl.name) || [],
          abstract: !!node.abstract,
          properties: {},
          methods: {}
        };

        node.body.body.forEach(member => {
          const memberName = member.key?.name || member.key?.value;

          if (member.type === 'PropertyDefinition' || member.type === 'TSPropertyDefinition') {
            const propInfo = {
              type: tsTypeToString(member.typeAnnotation?.typeAnnotation, typeRegistry),
              static: !!member.static,
              readonly: !!member.readonly,
              optional: !!member.optional,
              accessibility: member.accessibility || 'public', // public, private, protected
              abstract: !!member.abstract
            };
            classInfo.properties[memberName] = propInfo;
          }

          else if (member.type === 'MethodDefinition' || member.type === 'TSMethodDefinition') {
            const params = member.value?.params?.map(p => {
              // Parameter properties in constructor
              if (p.accessibility || p.readonly) {
                return {
                  name: p.parameter?.name || p.name,
                  type: tsTypeToString(p.parameter?.typeAnnotation?.typeAnnotation || p.typeAnnotation?.typeAnnotation, typeRegistry),
                  accessibility: p.accessibility || 'public',
                  readonly: !!p.readonly,
                  isParameterProperty: true
                };
              }
              return {
                name: p.name,
                type: tsTypeToString(p.typeAnnotation?.typeAnnotation, typeRegistry),
                optional: !!p.optional
              };
            }) || [];

            const methodInfo = {
              params,
              returnType: tsTypeToString(member.value?.returnType?.typeAnnotation, typeRegistry),
              static: !!member.static,
              accessibility: member.accessibility || 'public',
              abstract: !!member.abstract,
              async: !!member.value?.async,
              generator: !!member.value?.generator,
              kind: member.kind // 'method', 'get', 'set', 'constructor'
            };
            classInfo.methods[memberName || (member.kind === 'constructor' ? 'constructor' : 'unknown')] = methodInfo;
          }

          // Handle index signature in class
          else if (member.type === 'TSIndexSignature') {
            const indexParam = member.parameters?.[0];
            classInfo.indexSignature = {
              keyType: tsTypeToString(indexParam?.typeAnnotation?.typeAnnotation, typeRegistry),
              valueType: tsTypeToString(member.typeAnnotation?.typeAnnotation, typeRegistry),
              readonly: !!member.readonly
            };
          }
        });

        typeRegistry.push(classInfo);
      }
    }
  });

  return { ast, typeRegistry };
}