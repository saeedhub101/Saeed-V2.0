'use strict';

// lodash.isequal is deprecated and recommends node:util.isDeepStrictEqual.
// Keep the same callable CommonJS shape expected by electron-updater.
const { isDeepStrictEqual } = require('node:util');

module.exports = function isEqual(value, other) {
  return isDeepStrictEqual(value, other);
};
