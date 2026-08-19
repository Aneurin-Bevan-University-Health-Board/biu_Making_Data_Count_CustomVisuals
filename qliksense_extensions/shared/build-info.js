/**
 * build-info.js
 * =============
 * Version and build date shown in each visual so the build running in Qlik can
 * be checked against the zip that was imported.
 *
 * This file is the development placeholder; `scripts/build.js` overwrites the
 * copy in `dist/<extension>/lib/` with the real values at build time.
 */
(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NhsMdcBuildInfo = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 'dev';
  var BUILT_AT = '';

  return {
    version: VERSION,
    builtAt: BUILT_AT,
    label: BUILT_AT ? 'v' + VERSION + ' \u2022 built ' + BUILT_AT : 'v' + VERSION + ' (unbuilt)'
  };
}));
