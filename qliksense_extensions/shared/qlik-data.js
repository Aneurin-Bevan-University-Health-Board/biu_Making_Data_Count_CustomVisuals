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

    var cap = Math.max(Math.floor(maxRows) || 5000, 1);
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

  // ---------------------------------------------------------------------
  // Number formatting driven by the master measure's own format
  // ---------------------------------------------------------------------

  // Qlik NxNumberFormat.qType values that hold a duration/clock value.
  // Qlik stores these as a fraction of a day, so 0.5 === 12:00.
  var DURATION_TYPES = ['IV', 'T'];

  var DURATION_UNITS = { D: 86400, h: 3600, m: 60, s: 1 };

  /**
   * Some master measures carry an interval pattern (`hh:mm`) while reporting
   * an unspecified qType, so fall back to sniffing the pattern itself.
   */
  function looksLikeDuration(fmt) {
    if (!fmt || fmt.indexOf('#') !== -1 || fmt.indexOf('0') !== -1) { return false; }
    return fmt.indexOf(':') !== -1 && /[hms]/.test(fmt);
  }

  function padLeft(value, length) {
    var text = String(Math.floor(Math.abs(value)));
    while (text.length < length) { text = '0' + text; }
    return text;
  }

  /**
   * Split an interval/time format such as `hh:mm` or `[h]:mm:ss` into an
   * ordered list of `{unit, length}` tokens and literal separators.
   */
  function parseDurationPattern(pattern) {
    var tokens = [];
    var index = 0;
    while (index < pattern.length) {
      var char = pattern.charAt(index);
      if (char === '[' || char === ']') { index++; continue; }
      var unit = null;
      if (char === 'D' || char === 'd') { unit = 'D'; }
      else if (char === 'h' || char === 'H') { unit = 'h'; }
      else if (char === 'm') { unit = 'm'; }
      else if (char === 's') { unit = 's'; }
      if (unit) {
        var run = 0;
        while (index < pattern.length && pattern.charAt(index).toLowerCase() === char.toLowerCase()) {
          run++;
          index++;
        }
        tokens.push({ unit: unit, length: run });
      } else {
        tokens.push({ literal: char });
        index++;
      }
    }
    return tokens;
  }

  function formatDuration(value, pattern) {
    var tokens = parseDurationPattern(pattern || 'hh:mm');
    var units = tokens.filter(function (token) { return token.unit; });
    if (!units.length) { return String(value); }

    var smallest = units[units.length - 1].unit;
    var negative = value < 0;
    // Round at the smallest unit shown so 1:59:40 does not display as 1:59
    var seconds = Math.round(Math.abs(value) * 86400 / DURATION_UNITS[smallest]) *
      DURATION_UNITS[smallest];

    var remainder = seconds;
    var amounts = {};
    units.forEach(function (token, position) {
      var size = DURATION_UNITS[token.unit];
      // The leading unit accumulates (36:00 rather than 12:00 for 1.5 days)
      amounts[token.unit] = position === units.length - 1
        ? Math.round(remainder / size)
        : Math.floor(remainder / size);
      remainder -= amounts[token.unit] * size;
    });

    var text = tokens.map(function (token) {
      if (token.literal !== undefined) { return token.literal; }
      return padLeft(amounts[token.unit], token.length);
    }).join('');

    return negative ? '-' + text : text;
  }

  function applyThousands(intPart, separator) {
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  }

  function formatDecimal(value, numFormat, fallbackDecimals) {
    var fmt = numFormat.qFmt || '';
    var isPercent = fmt.indexOf('%') !== -1;
    var scaled = isPercent ? value * 100 : value;

    var core = fmt.match(/[#0][#0.,]*/);
    var pattern = core ? core[0] : '';

    var decimals = numFormat.qnDec;
    if (typeof decimals !== 'number' || !isFinite(decimals)) {
      var fraction = pattern.split('.')[1];
      if (fraction !== undefined) { decimals = fraction.length; }
      else if (pattern) { decimals = 0; }
      else { decimals = fallbackDecimals; }
    }
    if (decimals === null || decimals === undefined || !isFinite(decimals)) { decimals = 2; }

    var useThousands = numFormat.qUseThou !== undefined
      ? !!numFormat.qUseThou
      : pattern.split('.')[0].indexOf(',') !== -1;

    var text = Math.abs(scaled).toFixed(decimals);
    var parts = text.split('.');
    if (useThousands) {
      parts[0] = applyThousands(parts[0], numFormat.qThou || ',');
    }
    text = parts.join(numFormat.qDec || '.');
    if (scaled < 0) { text = '-' + text; }

    // Keep any currency symbol / unit text the master measure carries.
    // Qlik formats may contain semicolon-separated sections (positive;negative;
    // zero); pick the section that applies to this value before extracting
    // prefix/suffix so that multi-section formats are not appended verbatim.
    if (core) {
      var sections = fmt.split(';');
      var activeFmt = fmt;
      if (sections.length > 1) {
        if (scaled < 0 && sections.length >= 2) {
          activeFmt = sections[1];
        } else if (scaled === 0 && sections.length >= 3) {
          activeFmt = sections[2];
        } else {
          activeFmt = sections[0];
        }
      }
      var activeCore = activeFmt.match(/[#0][#0.,]*/);
      if (activeCore) {
        var prefix = activeFmt.slice(0, activeCore.index).replace(/['"]/g, '');
        var suffix = activeFmt.slice(activeCore.index + activeCore[0].length).replace(/['"%]/g, '');
        text = prefix + text + suffix;
      }
    }
    return isPercent ? text + '%' : text;
  }

  /**
   * Build a value formatter that honours a measure's own number format
   * (including hh:mm style durations) and falls back to a plain decimal
   * count when the measure has no usable format.
   *
   * @param {Object} numFormat `qMeasureInfo[n].qNumFormat`.
   * @param {number} [fallbackDecimals] Decimal places when the format is unknown.
   */
  function createFormatter(numFormat, fallbackDecimals) {
    var format = numFormat || {};
    var isDuration = (DURATION_TYPES.indexOf(format.qType) !== -1 && !!format.qFmt) ||
      looksLikeDuration(format.qFmt);

    return function (value) {
      if (value === null || value === undefined || !isFinite(Number(value))) {
        return 'n/a';
      }
      var num = Number(value);
      if (isDuration) { return formatDuration(num, format.qFmt); }
      if (format.qFmt || typeof format.qnDec === 'number') {
        return formatDecimal(num, format, fallbackDecimals);
      }
      var dp = (fallbackDecimals === null || fallbackDecimals === undefined)
        ? 2 : fallbackDecimals;
      return num.toFixed(dp);
    };
  }

  /**
   * Convenience wrapper: build a formatter from a measure in the layout.
   */
  function measureFormatter(layout, measureIndex, fallbackDecimals) {
    var hyperCube = (layout && layout.qHyperCube) || {};
    var info = (hyperCube.qMeasureInfo || [])[measureIndex || 0];
    return createFormatter(info && info.qNumFormat, fallbackDecimals);
  }

  /**
   * Convert hypercube rows into a single series.
   *
   * @param {Array} rows qMatrix rows.
   * @param {Object} spec `{labelIndex, valueIndex, denominatorIndex, targetIndex}`.
   * @returns {Object} `{labels, values, denominators, targets, elemNumbers}`
   */
  function toSeries(rows, spec) {
    var labelIndex = spec.labelIndex === undefined ? 0 : spec.labelIndex;
    var valueIndex = spec.valueIndex;
    var denominatorIndex = spec.denominatorIndex;
    var targetIndex = spec.targetIndex;

    var series = { labels: [], values: [], denominators: [], targets: [], elemNumbers: [] };

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

      if (targetIndex !== undefined && targetIndex !== null) {
        series.targets.push(cellNumber(row[targetIndex]));
      }
    });

    var validDenominators = series.denominators.length === series.values.length &&
      series.denominators.every(function (d) { return isFinite(d) && d > 0; });
    if (!validDenominators) {
      series.denominators = null;
    }

    var validTargets = series.targets.length === series.values.length &&
      series.targets.every(function (t) { return isFinite(t); });
    if (!validTargets) {
      series.targets = null;
    }

    return series;
  }

  /**
   * Group hypercube rows by a grouping dimension and build one series per
   * group (used by the summary table).
   *
   * @param {Array} rows qMatrix rows.
   * @param {Object} spec `{groupIndex, labelIndex, valueIndex, denominatorIndex, targetIndex, descriptionIndex}`.
   * @returns {Array} Array of `{label, description, elemNumber, series}` in first-seen order.
   */
  function groupSeries(rows, spec) {
    var groups = [];
    var lookup = {};

    rows.forEach(function (row) {
      var cell = row[spec.groupIndex];
      var elemNum = cell ? cell.qElemNumber : undefined;
      var displayText = cellText(cell);
      // Use qElemNumber as the grouping key when available; fall back to display
      // text only when the element number is absent (e.g. totals rows).
      var key = (elemNum !== undefined && elemNum !== null) ? 'e:' + elemNum : 't:' + displayText;
      if (!Object.prototype.hasOwnProperty.call(lookup, key)) {
        lookup[key] = {
          label: displayText,
          elemNumber: elemNum !== undefined ? elemNum : null,
          rows: []
        };
        groups.push(lookup[key]);
      }
      lookup[key].rows.push(row);
    });

    var descriptionIndex = spec.descriptionIndex;

    return groups.map(function (group) {
      return {
        label: group.label,
        // A description is a per-measure attribute, so the first row carries it
        description: descriptionIndex === undefined || descriptionIndex === null
          ? '' : cellText(group.rows[0][descriptionIndex]),
        elemNumber: group.elemNumber,
        series: toSeries(group.rows, {
          labelIndex: spec.labelIndex,
          valueIndex: spec.valueIndex,
          denominatorIndex: spec.denominatorIndex,
          targetIndex: spec.targetIndex
        })
      };
    });
  }

  return {
    MAX_CELLS_PER_PAGE: MAX_CELLS_PER_PAGE,
    fetchRows: fetchRows,
    toSeries: toSeries,
    groupSeries: groupSeries,
    createFormatter: createFormatter,
    measureFormatter: measureFormatter,
    formatDuration: formatDuration,
    cellNumber: cellNumber,
    cellText: cellText
  };
}));
