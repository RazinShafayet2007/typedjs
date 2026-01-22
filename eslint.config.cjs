const parser = require("/home/razin/.vscode/extensions/razinshafayet.typedjs-vscode-0.0.1/server/parser.js");
const noOp = require("/home/razin/.vscode/extensions/razinshafayet.typedjs-vscode-0.0.1/server/rules/no-op.js");

const typedjsPlugin = {
  rules: {
    "no-op": noOp
  }
};

module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: {
      parser: parser
    },
    plugins: {
      typedjs: typedjsPlugin
    },
    rules: {
      "typedjs/no-op": "error"
    }
  }
];