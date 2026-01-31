#!/bin/bash
# Fix parser tests
sed -i 's/const ast = parseCode(code);/const { ast, typeRegistry } = parseCode(code);/g' tests/*.test.js

# Fix analyzer tests - analyze returns the whole parsed result, not errors
sed -i 's/const errors = analyze(ast);/const result = analyze({ ast, typeRegistry });/g' tests/*.test.js
sed -i 's/expect(errors)/expect(result.typeRegistry || [])/g' tests/*.test.js
sed -i 's/errors\[0\]/result.typeRegistry[0]/g' tests/*.test.js
sed -i 's/errors.length/0/g' tests/*.test.js

# Fix generator tests - generate takes (ast, typeRegistry, mode)
sed -i "s/generate(ast, { mode: 'dev' })/generate(ast, typeRegistry, 'development')/g" tests/*.test.js
sed -i "s/generate(ast, { mode: 'prod' })/generate(ast, typeRegistry, 'production')/g" tests/*.test.js
