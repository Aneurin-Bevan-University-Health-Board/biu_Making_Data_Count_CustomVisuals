/**
 * abspc-spc-chart.js
 * ==================
 * NHS Making Data Count SPC chart for Qlik Sense Enterprise on Windows
 * (client-managed / on-premise).
 *
 * Data model: one dimension (the time period) and a single charted measure —
 * measure 1 is the value and optional measure 2 is only the denominator /
 * subgroup size used by p and u charts. A target is never a measure: it is
 * set as a value or a target expression in the property panel.
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
        showZoneC: false,
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

      if (measureCount > 2) {
        render.renderMessage(
          element,
          'Only one measure can be charted (with an optional second measure as the ' +
          'denominator for p / u charts). Set the target as a value or a target ' +
          'expression under NHS MDC analysis rather than as another measure.',
          true
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

          // A second measure is only ever the denominator for p / u charts
          var hasDenominator = measureCount > 1;

          var series = qlikData.toSeries(rows, {
            labelIndex: 0,
            valueIndex: dimensionCount,
            denominatorIndex: hasDenominator ? dimensionCount + 1 : null,
            targetIndex: null
          });

          if (!series.values.length) {
            render.renderMessage(element, 'No numeric values to display.');
            return;
          }

          // The target comes from the target value / target expression only
          var targetValue = propsUi.settingBoolean(props, 'useTarget', false)
            ? settingNumber(props, 'target', null)
            : null;

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
            showZoneC: !!props.showZoneC,
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
