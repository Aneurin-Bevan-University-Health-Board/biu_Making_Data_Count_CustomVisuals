/**
 * test_looker_bundle.cjs
 * ======================
 * Checks that the LookML bundles load as classic (non-module) scripts, the way
 * Looker loads custom visualizations, and that the XmR chart renders
 * Looker-shaped query results.
 * Run with:  node tests/test_looker_bundle.cjs
 */

const vm = require('vm');
const { bundleChartFile, extractUtilsCode } = require('../scripts/bundle-for-lookml.cjs');

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    passed++;
    console.log('  ✓ ' + label);
  } else {
    failed++;
    console.log('  ✗ ' + label + ' — expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

// ─── Minimal DOM stub ───
function createNode(tag) {
  return {
    tagName: tag,
    children: [],
    attributes: {},
    style: {},
    textContent: '',
    _innerHTML: '',
    set innerHTML(html) { this._innerHTML = html; this.children = html ? [createNode('div')] : []; },
    get innerHTML() { return this._innerHTML; },
    get firstChild() { return this.children[0] || null; },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getBoundingClientRect() { return { width: 800, height: 400 }; }
  };
}

function findAll(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  node.children.forEach(child => findAll(child, tag, out));
  return out;
}

const documentStub = {
  createElement: createNode,
  createElementNS: (ns, tag) => createNode(tag)
};

const utilsCode = extractUtilsCode();

// ─── All single-chart bundles must parse as classic scripts ───
console.log('\nBundles parse as classic scripts:');
['xmr_chart.js', 'p_chart.js', 'u_chart.js', 'c_chart.js', 't_chart.js', 'g_chart.js', 'run_chart.js', 'summary_table.js']
  .forEach(file => {
    const { content, fileName } = bundleChartFile(file, utilsCode);
    let error = null;
    try {
      new vm.Script(content, { filename: fileName });
    } catch (e) {
      error = e.message;
    }
    assert(fileName + ' parses without ES module syntax', error, null);
  });

// ─── XmR chart registers with Looker and renders Looker query results ───
console.log('\nXmR chart in a Looker-like environment:');
let registered = null;
const context = vm.createContext({
  console: { log: console.log, warn: () => {}, error: () => {} },
  document: documentStub,
  looker: { plugins: { visualizations: { add: viz => { registered = viz; } } } }
});
vm.runInContext(bundleChartFile('xmr_chart.js', utilsCode).content, context);
assert('XmR chart registered via looker.plugins.visualizations.add', registered !== null, true);

// Looker-shaped data: 44 months, newest first, cells as { value, rendered }
const dimName = 'provider_stays.ps_discharge_month';
const measureName = 'provider_stays.count';
const months = [];
for (let i = 0; i < 44; i++) {
  const year = 2023 + Math.floor(i / 12);
  const month = String((i % 12) + 1).padStart(2, '0');
  months.push(year + '-' + month);
}
const lookerData = months.map((m, i) => ({
  [dimName]: { value: m, rendered: m },
  [measureName]: { value: 14000 + (i % 7) * 300, rendered: String(14000 + (i % 7) * 300) }
})).reverse();
lookerData.push({ [dimName]: { value: null }, [measureName]: { value: null } });
const queryResponse = {
  fields: {
    dimension_like: [{ name: dimName, type: 'date_month', is_timeframe: true }],
    measure_like: [{ name: measureName, type: 'count' }]
  }
};

function render(args) {
  const element = createNode('div');
  registered.create(element, {});
  let doneCalls = 0;
  const done = () => { doneCalls++; };
  registered.updateAsync(...args(element, done));
  return { element, doneCalls };
}

// Looker's 6-argument signature with the default option values
const config = { value_column: 'value', improvement_direction: 'high' };
let result = render((element, done) => [lookerData, element, config, queryResponse, {}, done]);
let container = result.element.children[0];
let circles = findAll(container, 'circle').filter(c => c.children.length > 0);
assert('done() called exactly once', result.doneCalls, 1);
assert('no error rendered', /Error/.test(container.innerHTML), false);
assert('one point per non-null month', circles.length, 44);
assert('points ordered chronologically (first)', circles[0].children[0].textContent.startsWith('2023-01'), true);
assert('points ordered chronologically (last)', circles[43].children[0].textContent.startsWith('2026-08'), true);

// Legacy 5-argument call (used by AutoChart)
result = render((element, done) => [lookerData, element, config, queryResponse, done]);
assert('legacy 5-argument call still calls done()', result.doneCalls, 1);

// Missing value column with no measures reports an error and still calls done()
result = render((element, done) => [[{ other: 1 }], element, {}, { fields: {} }, {}, done]);
container = result.element.children[0];
assert('missing column shows error', /not found/.test(container.firstChild.textContent), true);
assert('done() called after error', result.doneCalls, 1);

console.log('\n  Passed: ' + passed);
console.log('  Failed: ' + failed);
if (failed > 0) {
  process.exit(1);
}
