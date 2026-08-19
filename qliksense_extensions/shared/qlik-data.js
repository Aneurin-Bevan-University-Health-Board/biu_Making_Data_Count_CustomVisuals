/**
 * qlik-data.js
 * ============
 * Hypercube helpers shared by the NHS Making Data Count Qlik Sense
 * extensions: paged data fetching and conversion of the hypercube matrix
 * into plain series that `spc-engine.js` understands.
 */
(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NhsMdcQlikData = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Qlik Engine allows a maximum of 10,000 cells per data page
  var MAX_CELLS_PER_PAGE = 10000;

  function collectPages(pages, store) {
    (pages || []).forEach(function (page) {
      if (!page || !page.qMatrix) { return; }
      var top = page.qArea ? page.qArea.qTop : 0;
      page.qMatrix.forEach(function (row, index) {
        store[top + index] = row;
      });
    });
  }

  function storeToRows(store, total) {
    var rows = [];
    for (var i = 0; i < total; i++) {
      if (!store[i]) { break; }
      rows.push(store[i]);
    }
    return rows;
  }

  /**
   * Fetch up to `maxRows` hypercube rows, paging through the engine as
   * required. Returns a promise resolving to an array of qMatrix rows.
   *
   * @param {Object} backendApi The extension's `this.backendApi`.
   * @param {Object} layout The extension layout (with `qHyperCube`).
   * @param {number} [maxRows] Safety cap on the number of rows (default 5000).
   */
  function fetchRows(backendApi, layout, maxRows) {
    var hyperCube = layout && layout.qHyperCube;
    if (!hyperCube || !hyperCube.qSize) {
      return Promise.resolve([]);
    }

    var cap = maxRows || 5000;
    var total = Math.min(hyperCube.qSize.qcy, cap);
    var width = hyperCube.qSize.qcx;
    var store = [];
    collectPages(hyperCube.qDataPages, store);

    var rows = storeToRows(store, total);
    if (rows.length >= total || !backendApi || typeof backendApi.getData !== 'function') {
      return Promise.resolve(rows.slice(0, total));
    }

    var pageHeight = Math.max(Math.floor(MAX_CELLS_PER_PAGE / Math.max(width, 1)), 1);

    function next() {
      var current = storeToRows(store, total);
      if (current.length >= total) {
        return Promise.resolve(current.slice(0, total));
      }
      var request = {
        qTop: current.length,
        qLeft: 0,
        qWidth: width,
        qHeight: Math.min(pageHeight, total - current.length)
      };
      var before = current.length;
      return Promise.resolve(backendApi.getData([request])).then(function (pages) {
        collectPages(pages, store);
        var after = storeToRows(store, total).length;
        if (after <= before) {
          // Engine returned nothing new — stop rather than loop forever
          return storeToRows(store, total);
        }
        return next();
      });
    }

    return next();
  }

  function cellNumber(cell) {
    if (!cell) { return NaN; }
    if (typeof cell.qNum === 'number' && isFinite(cell.qNum)) { return cell.qNum; }
    var parsed = Number(cell.qText);
    return isFinite(parsed) ? parsed : NaN;
  }

  function cellText(cell) {
    if (!cell) { return ''; }
    return cell.qText === undefined || cell.qText === null ? '' : String(cell.qText);
  }

  /**
   * Convert hypercube rows into a single series.
   *
   * @param {Array} rows qMatrix rows.
   * @param {Object} spec `{labelIndex, valueIndex, denominatorIndex}`.
   * @returns {Object} `{labels, values, denominators, elemNumbers}`
   */
  function toSeries(rows, spec) {
    var labelIndex = spec.labelIndex === undefined ? 0 : spec.labelIndex;
    var valueIndex = spec.valueIndex;
    var denominatorIndex = spec.denominatorIndex;

    var series = { labels: [], values: [], denominators: [], elemNumbers: [] };

    rows.forEach(function (row) {
      var value = cellNumber(row[valueIndex]);
      if (!isFinite(value)) { return; }

      series.labels.push(labelIndex === null ? '' : cellText(row[labelIndex]));
      series.elemNumbers.push(
        labelIndex === null || !row[labelIndex] ? null : row[labelIndex].qElemNumber
      );
      series.values.push(value);

      if (denominatorIndex !== undefined && denominatorIndex !== null) {
        series.denominators.push(cellNumber(row[denominatorIndex]));
      }
    });

    var validDenominators = series.denominators.length === series.values.length &&
      series.denominators.every(function (d) { return isFinite(d) && d > 0; });
    if (!validDenominators) {
      series.denominators = null;
    }

    return series;
  }

  /**
   * Group hypercube rows by a grouping dimension and build one series per
   * group (used by the summary table).
   *
   * @param {Array} rows qMatrix rows.
   * @param {Object} spec `{groupIndex, labelIndex, valueIndex, denominatorIndex}`.
   * @returns {Array} Array of `{label, elemNumber, series}` in first-seen order.
   */
  function groupSeries(rows, spec) {
    var groups = [];
    var lookup = {};

    rows.forEach(function (row) {
      var key = cellText(row[spec.groupIndex]);
      if (!Object.prototype.hasOwnProperty.call(lookup, key)) {
        lookup[key] = {
          label: key,
          elemNumber: row[spec.groupIndex] ? row[spec.groupIndex].qElemNumber : null,
          rows: []
        };
        groups.push(lookup[key]);
      }
      lookup[key].rows.push(row);
    });

    return groups.map(function (group) {
      return {
        label: group.label,
        elemNumber: group.elemNumber,
        series: toSeries(group.rows, {
          labelIndex: spec.labelIndex,
          valueIndex: spec.valueIndex,
          denominatorIndex: spec.denominatorIndex
        })
      };
    });
  }

  return {
    MAX_CELLS_PER_PAGE: MAX_CELLS_PER_PAGE,
    fetchRows: fetchRows,
    toSeries: toSeries,
    groupSeries: groupSeries,
    cellNumber: cellNumber,
    cellText: cellText
  };
}));
