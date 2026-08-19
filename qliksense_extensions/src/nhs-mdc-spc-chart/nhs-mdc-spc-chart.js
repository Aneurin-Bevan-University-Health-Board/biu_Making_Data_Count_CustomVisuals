/**
 * nhs-mdc-spc-chart.js
 * ====================
 * NHS Making Data Count SPC chart for Qlik Sense Enterprise on Windows
 * (client-managed / on-premise).
 *
 * Data model: one dimension (the time period) and one or two measures —
 * measure 1 is the value, optional measure 2 is the denominator / subgroup
 * size used by p and u charts.
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
        rebaseOn: 'improvement',
        baseline: 15,
        minPhaseLength: 8,
        title: '',
        decimals: 2,
        showControlLimits: true,
        showWarningLimits: false,
        showCentreLine: true,
        showTargetLine: true,
        showLegend: true,
        showIcons: true,
        allowSelections: true,
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
          'Add one dimension (time period) and at least one measure (value) to build the SPC chart.'
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
            rebaseOn: props.rebaseOn,
            baseline: numberOr(props.baseline, 15),
            minPhaseLength: numberOr(props.minPhaseLength, 8)
          });

          var title = props.title;
          if (!title) {
            var measureLabel = hyperCube.qMeasureInfo[0].qFallbackTitle || 'Value';
            title = measureLabel + ' \u2014 ' +
              (render.CHART_TYPE_LABELS[analysis.chartType] || analysis.chartType);
          }

          render.renderChart(element, analysis, {
            labels: series.labels,
            width: element.clientWidth,
            height: element.clientHeight,
            title: title,
            decimals: numberOr(props.decimals, 2),
            showControlLimits: props.showControlLimits !== false,
            showWarningLimits: !!props.showWarningLimits,
            showCentreLine: props.showCentreLine !== false,
            showTargetLine: props.showTargetLine !== false,
            showLegend: props.showLegend !== false,
            showIcons: props.showIcons !== false,
            onPointClick: props.allowSelections === false ? null : function (index) {
              var elemNumber = series.elemNumbers[index];
              if (elemNumber === null || elemNumber === undefined || elemNumber < 0) { return; }
              self.selectValues(0, [elemNumber], true);
            }
          });
        })
        .catch(function (error) {
          render.renderMessage(element, 'NHS MDC SPC chart error: ' + error.message, true);
        });
    }
  };
});
