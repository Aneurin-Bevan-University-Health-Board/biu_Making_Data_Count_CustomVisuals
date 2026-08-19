/**
 * nhs-mdc-summary-table.js
 * ========================
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
        qInitialDataFetch: [{ qWidth: 4, qHeight: 2500 }],
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
        decimals: 2,
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

      if (dimensionCount < 2 || measureCount < 1) {
        render.renderMessage(
          element,
          'Add two dimensions (measure name, then time period) and at least one measure (value).'
        );
        return Promise.resolve();
      }

      return qlikData.fetchRows(self.backendApi, layout, numberOr(props.maxRows, 5000))
        .then(function (rows) {
          if (!rows.length) {
            render.renderMessage(element, 'No data to display.');
            return;
          }

          var groups = qlikData.groupSeries(rows, {
            groupIndex: 0,
            labelIndex: 1,
            valueIndex: dimensionCount,
            denominatorIndex: measureCount > 1 ? dimensionCount + 1 : null
          });

          var tableRows = groups.map(function (group) {
            var row = { label: group.label, elemNumber: group.elemNumber };
            try {
              row.analysis = engine.analyse(group.series.values, {
                chartType: props.chartType || 'auto',
                subgroupSizes: group.series.denominators,
                improvementDirection: props.improvementDirection,
                target: props.useTarget ? numberOr(props.target, null) : null,
                autoRebase: !!props.autoRebase,
                rebaseOn: props.rebaseOn
              });
            } catch (error) {
              row.error = error.message;
            }
            return row;
          });

          render.renderSummaryTable(element, tableRows, {
            decimals: numberOr(props.decimals, 2),
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
