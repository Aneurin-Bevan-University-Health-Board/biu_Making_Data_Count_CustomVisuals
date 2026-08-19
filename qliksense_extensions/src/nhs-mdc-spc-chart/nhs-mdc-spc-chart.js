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
  './lib/props-ui',
  './lib/qlik-context',
  './properties'
], function (engine, render, qlikData, propsUi, qlikContext, properties) {
  'use strict';

  function elementOf($element) {
    return $element && $element[0] ? $element[0] : $element;
  }

  function numberOr(value, fallback) {
    if (value === null || value === undefined || value === '') { return fallback; }
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
        autoRebaseMode: 'fixed',
        autoRebase: false,
        autoRebaseExpression: '',
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
        showControlLimits: true,
        showWarningLimits: false,
        showCentreLine: true,
        showTargetLine: true,
        showLegend: true,
        showIcons: true,
        allowSelections: true,
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
          'Add one dimension (time period) and at least one measure (value) to build the SPC chart.'
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

          // Determine target index: if 3+ measures, 3rd is dynamic target
          var hasDenominator = measureCount > 1;
          var hasDynamicTarget = measureCount > (hasDenominator ? 2 : 1);
          var targetIndex = hasDynamicTarget 
            ? dimensionCount + (hasDenominator ? 2 : 1)
            : null;

          var series = qlikData.toSeries(rows, {
            labelIndex: 0,
            valueIndex: dimensionCount,
            denominatorIndex: hasDenominator ? dimensionCount + 1 : null,
            targetIndex: targetIndex
          });

          if (!series.values.length) {
            render.renderMessage(element, 'No numeric values to display.');
            return;
          }

          // Use dynamic target if available, otherwise fall back to static property
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
            autoRebase: propsUi.settingBoolean(props, 'autoRebase', false),
            rebaseOn: propsUi.settingText(props, 'rebaseOn', 'improvement', propsUi.REBASE_VALUES),
            baseline: settingNumber(props, 'baseline', 15),
            minPhaseLength: settingNumber(props, 'minPhaseLength', 8)
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
            formatValue: qlikData.measureFormatter(layout, 0, numberOr(props.decimals, 2)),
            showControlLimits: props.showControlLimits !== false,
            showWarningLimits: !!props.showWarningLimits,
            showCentreLine: props.showCentreLine !== false,
            showTargetLine: props.showTargetLine !== false,
            showLegend: props.showLegend !== false,
            showIcons: props.showIcons !== false,
            showBuildStamp: props.showBuildStamp !== false,
            stampText: qlikContext.stampText(context),
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
