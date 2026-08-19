/**
 * nhs-mdc-variation-icon.js
 * =========================
 * NHS Making Data Count variation / assurance KPI tile for Qlik Sense
 * Enterprise on Windows (client-managed / on-premise).
 *
 * Data model: one dimension (the time period) and one or two measures —
 * measure 1 is the value, optional measure 2 is the denominator used by
 * p and u charts. The tile shows the latest value together with the MDC
 * variation and assurance icons for the series.
 */
define([
  './lib/spc-engine',
  './lib/spc-render',
  './lib/qlik-data',
  './properties'
], function (engine, render, qlikData, properties) {
  'use strict';

  function elementOf($element) {
    return $element && $element[0] ? $element[0] : $element;
  }

  function numberOr(value, fallback) {
    var num = Number(value);
    return isFinite(num) ? num : fallback;
  }

  return {
    initialProperties: {
      version: 1.0,
      qHyperCubeDef: {
        qDimensions: [],
        qMeasures: [],
        qInitialDataFetch: [{ qWidth: 3, qHeight: 3333 }],
        qSuppressZero: false,
        qSuppressMissing: true
      },
      props: {
        chartType: 'auto',
        improvementDirection: 'high',
        useTarget: false,
        target: 0,
        autoRebase: false,
        title: '',
        decimals: 2,
        showLabels: true,
        maxRows: 5000
      }
    },

    definition: properties,

    support: {
      snapshot: true,
      export: true,
      exportData: true
    },

    paint: function ($element, layout) {
      var self = this;
      var element = elementOf($element);
      var props = layout.props || {};
      var hyperCube = layout.qHyperCube || {};
      var dimensionCount = (hyperCube.qDimensionInfo || []).length;
      var measureCount = (hyperCube.qMeasureInfo || []).length;

      if (dimensionCount < 1 || measureCount < 1) {
        render.renderMessage(
          element,
          'Add one dimension (time period) and at least one measure (value).'
        );
        return Promise.resolve();
      }

      return qlikData.fetchRows(self.backendApi, layout, numberOr(props.maxRows, 5000))
        .then(function (rows) {
          if (!rows.length) {
            render.renderMessage(element, 'No data to display.');
            return;
          }

          var series = qlikData.toSeries(rows, {
            labelIndex: 0,
            valueIndex: dimensionCount,
            denominatorIndex: measureCount > 1 ? dimensionCount + 1 : null
          });

          if (!series.values.length) {
            render.renderMessage(element, 'No numeric values to display.');
            return;
          }

          var analysis = engine.analyse(series.values, {
            chartType: props.chartType || 'auto',
            subgroupSizes: series.denominators,
            improvementDirection: props.improvementDirection,
            target: props.useTarget ? numberOr(props.target, null) : null,
            autoRebase: !!props.autoRebase,
            rebaseOn: props.rebaseOn
          });

          render.renderIconKpi(element, analysis, {
            title: props.title || hyperCube.qMeasureInfo[0].qFallbackTitle || '',
            decimals: numberOr(props.decimals, 2),
            showLabels: props.showLabels !== false
          });
        })
        .catch(function (error) {
          render.renderMessage(element, 'NHS MDC variation icon error: ' + error.message, true);
        });
    }
  };
});
