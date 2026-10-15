'use strict';

// Small compatibility parser for roarr's boolean environment flags.
module.exports = function boolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }
  if (typeof value !== 'string') return undefined;
  switch (value.trim().toLowerCase()) {
    case 'true': case '1': case 'yes': case 'y': case 'on': return true;
    case 'false': case '0': case 'no': case 'n': case 'off': return false;
    default: return undefined;
  }
};
