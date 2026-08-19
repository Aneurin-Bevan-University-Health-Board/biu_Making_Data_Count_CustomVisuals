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
  './lib/props-ui',
  './lib/qlik-context',
  './properties'
], function (engine, render, qlikData, propsUi, qlikContext, properties) {
  'use strict';

  function elementOf($element) {
    return $element && $element[0] ? $element[0] : $element;
  }

  function numberOr(value, fallback) {
    var num = Number(value);
    return isFinite(num) ? num : fallback;
  }

  function settingNumber(props, key, fallback) {
    return numberOr(propsUi.settingValue(props, key, fallback), fallback);
  }

  return {
    initialProperties: {
      version: 1.0,
      qHyperCubeDef: {
        qDimensions: [],
        qMeasures: [],
        qInitialDataFetch: [{ qWidth: 4, qHeight: 2500 }],
        qSuppressZero: false,
        qSuppressMissing: true
      },
      props: {
        chartTypeMode: 'fixed',
        chartType: 'auto',
        chartTypeExpression: '',
        improvementDirectionMode: 'fixed',
        improvementDirection: 'high',
        improvementDirectionExpression: '',
        useTargetMode: 'fixed',
        useTarget: false,
        useTargetExpression: '',
        targetMode: 'fixed',
        target: 0,
        targetExpression: '',
        autoRebase: false,
        rebaseOnMode: 'fixed',
        rebaseOn: 'improvement',
        rebaseOnExpression: '',
        baselineMode: 'fixed',
        baseline: 15,
        baselineExpression: '',
        minPhaseLengthMode: 'fixed',
        minPhaseLength: 8,
        minPhaseLengthExpression: '',
        title: '',
        decimals: 2,
        showLabels: true,
        showBuildStamp: true,
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

      return Promise.all([
        qlikData.fetchRows(self.backendApi, layout, numberOr(props.maxRows, 5000)),
        qlikContext.load(self)
      ])
        .then(function (replies) {
          var rows = replies[0];
          var context = replies[1];
          if (!rows.length) {
            render.renderMessage(element, 'No data to display.');
            return;
          }

          // Measure 3 (or 2 without a denominator) is an optional target per time period
          var hasDenominator = measureCount > 1;
          var hasDynamicTarget = measureCount > (hasDenominator ? 2 : 1);

          var series = qlikData.toSeries(rows, {
            labelIndex: 0,
            valueIndex: dimensionCount,
            denominatorIndex: hasDenominator ? dimensionCount + 1 : null,
            targetIndex: hasDynamicTarget
              ? dimensionCount + (hasDenominator ? 2 : 1) : null
          });

          if (!series.values.length) {
            render.renderMessage(element, 'No numeric values to display.');
            return;
          }

          var targetValue = series.targets
            ? series.targets
            : (propsUi.settingBoolean(props, 'useTarget', false)
              ? settingNumber(props, 'target', null) : null);

          var analysis = engine.analyse(series.values, {
            chartType: propsUi.settingText(props, 'chartType', 'auto', propsUi.CHART_TYPE_VALUES),
            subgroupSizes: series.denominators,
            improvementDirection: propsUi.settingText(
              props, 'improvementDirection', 'high', propsUi.DIRECTION_VALUES
            ),
            target: targetValue,
            autoRebase: !!props.autoRebase,
            rebaseOn: propsUi.settingText(props, 'rebaseOn', 'improvement', propsUi.REBASE_VALUES),
            baseline: settingNumber(props, 'baseline', 15),
            minPhaseLength: settingNumber(props, 'minPhaseLength', 8)
          });

          render.renderIconKpi(element, analysis, {
            title: props.title || hyperCube.qMeasureInfo[0].qFallbackTitle || '',
            decimals: numberOr(props.decimals, 2),
            formatValue: qlikData.measureFormatter(layout, 0, numberOr(props.decimals, 2)),
            showLabels: props.showLabels !== false,
            showBuildStamp: props.showBuildStamp !== false,
            stampText: qlikContext.stampText(context)
          });
        })
        .catch(function (error) {
          render.renderMessage(element, 'NHS MDC variation icon error: ' + error.message, true);
        });
    }
  };
});
