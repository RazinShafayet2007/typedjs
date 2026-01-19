// typed-js/eslint.config.cjs
const typedjs = require("eslint-plugin-typedjs");

module.exports = [
  ...typedjs.configs.recommended,
  {
    files: ["**/*.js"],
    // You can override rules here if you want
    rules: {
      "typedjs/no-op": "error" 
    }
  }
];