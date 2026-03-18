/**
 * initialProperties.js
 * =====================
 * Default property values for the ABSPC SPC Chart extension.
 */
define([], function () {
  'use strict';

  return {
    qHyperCubeDef: {
      qDimensions: [],
      qMeasures: [],
      qInitialDataFetch: [{
        qWidth: 2,
        qHeight: 500
      }]
    },
    chartType: 'xmr',
    improvementDirection: 'high',
    showControlLimits: true,
    showWarningLimits: false,
    showCenterLine: true,
    showTargetLine: false,
    targetValue: null,
    chartTitle: ''
  };
});
