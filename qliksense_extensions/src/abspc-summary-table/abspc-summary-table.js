/**
 * abspc-summary-table.js
 * ======================
 * NHS Making Data Count summary table for Qlik Sense Enterprise on Windows
 * (client-managed / on-premise).
 *
 * Data model: two dimensions — dimension 1 is the measure / service being
 * monitored, dimension 2 is the time period — plus one or two measures
 * (value and optional denominator). One SPC analysis is run per group and
 * the resulting variation and assurance icons are shown per row.
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
        qInitialDataFetch: [{ qWidth: 6, qHeight: 1600 }],
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
        decimals: 2,
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

      if (dimensionCount < 2 || measureCount < 1) {
        render.renderMessage(
          element,
          'Add two dimensions (measure name, then time period) and at least one measure (value).'
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
          var hasDescription = dimensionCount > 2;

          var groups = qlikData.groupSeries(rows, {
            groupIndex: 0,
            labelIndex: 1,
            descriptionIndex: hasDescription ? 2 : null,
            valueIndex: dimensionCount,
            denominatorIndex: hasDenominator ? dimensionCount + 1 : null,
            targetIndex: hasDynamicTarget
              ? dimensionCount + (hasDenominator ? 2 : 1) : null
          });

          var analysisOptions = {
            chartType: propsUi.settingText(props, 'chartType', 'auto', propsUi.CHART_TYPE_VALUES),
            improvementDirection: propsUi.settingText(
              props, 'improvementDirection', 'high', propsUi.DIRECTION_VALUES
            ),
            target: propsUi.settingBoolean(props, 'useTarget', false)
              ? settingNumber(props, 'target', null) : null,
            autoRebase: propsUi.settingBoolean(props, 'autoRebase', false),
            rebaseOn: propsUi.settingText(props, 'rebaseOn', 'improvement', propsUi.REBASE_VALUES),
            baseline: settingNumber(props, 'baseline', 15),
            minPhaseLength: settingNumber(props, 'minPhaseLength', 8)
          };

          var tableRows = groups.map(function (group) {
            var labels = group.series.labels;
            var row = {
              label: group.label,
              description: group.description,
              elemNumber: group.elemNumber,
              latestLabel: labels.length ? labels[labels.length - 1] : ''
            };
            try {
              row.analysis = engine.analyse(group.series.values, {
                chartType: analysisOptions.chartType,
                subgroupSizes: group.series.denominators,
                improvementDirection: analysisOptions.improvementDirection,
                target: group.series.targets || analysisOptions.target,
                autoRebase: analysisOptions.autoRebase,
                rebaseOn: analysisOptions.rebaseOn,
                baseline: analysisOptions.baseline,
                minPhaseLength: analysisOptions.minPhaseLength
              });
            } catch (error) {
              row.error = error.message;
            }
            return row;
          });

          render.renderSummaryTable(element, tableRows, {
            decimals: numberOr(props.decimals, 2),
            formatValue: qlikData.measureFormatter(layout, 0, numberOr(props.decimals, 2)),
            showDescription: hasDescription,
            showBuildStamp: props.showBuildStamp !== false,
            stampText: qlikContext.stampText(context),
            onRowClick: props.allowSelections === false ? null : function (row) {
              if (row.elemNumber === null || row.elemNumber === undefined || row.elemNumber < 0) {
                return;
              }
              self.selectValues(0, [row.elemNumber], true);
            }
          });
        })
        .catch(function (error) {
          render.renderMessage(element, 'NHS MDC summary table error: ' + error.message, true);
        });
    }
  };
});
