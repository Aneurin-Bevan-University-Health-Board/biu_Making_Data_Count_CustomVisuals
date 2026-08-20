/**
 * build.js
 * ========
 * Zero-dependency build script for the NHS Making Data Count Qlik Sense
 * extensions.
 *
 * For every extension in `src/` it:
 *   1. copies the extension files into `dist/<extension>/`
 *   2. copies the shared modules from `shared/` into `dist/<extension>/lib/`
 *   3. writes `dist/<extension>.zip`, ready to import through the Qlik
 *      Management Console (QMC) on Qlik Sense Enterprise on Windows.
 *
 * Usage: `node scripts/build.js` (or `npm run build`).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const SHARED_DIR = path.join(ROOT, 'shared');
const DIST_DIR = path.join(ROOT, 'dist');

const SHARED_FILES = ['spc-engine.js', 'spc-render.js', 'qlik-data.js', 'props-ui.js', 'qlik-context.js', 'build-info.js'];

const PKG_VERSION = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
).version;

const BUILD_DATE = new Date();

function stampText(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
    ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

const BUILD_STAMP = stampText(BUILD_DATE);

// ---------------------------------------------------------------------------
// Minimal ZIP writer (deflate + store), so no npm dependencies are required
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xFF];
  }
  return (crc ^ -1) >>> 0;
}

function dosDateTime(date) {
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) |
    (Math.floor(date.getSeconds() / 2))) & 0xFFFF;
  const day = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) |
    date.getDate()) & 0xFFFF;
  return { time, day };
}

function createZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const { time, day } = dosDateTime(now);

  entries.forEach((entry) => {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const deflated = zlib.deflateRawSync(entry.data, { level: 9 });
    const useDeflate = deflated.length < entry.data.length;
    const payload = useDeflate ? deflated : entry.data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(entry.data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);          // version needed
    localHeader.writeUInt16LE(0, 6);           // flags
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(day, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);          // extra field length

    chunks.push(localHeader, nameBuffer, payload);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);        // version made by
    centralHeader.writeUInt16LE(20, 6);        // version needed
    centralHeader.writeUInt16LE(0, 8);         // flags
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(day, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);        // extra field length
    centralHeader.writeUInt16LE(0, 32);        // comment length
    centralHeader.writeUInt16LE(0, 34);        // disk number
    centralHeader.writeUInt16LE(0, 36);        // internal attributes
    centralHeader.writeUInt32LE(0, 38);        // external attributes
    centralHeader.writeUInt32LE(offset, 42);

    central.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + payload.length;
  });

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([Buffer.concat(chunks), centralBuffer, end]);
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function listFiles(dir, prefix) {
  const base = prefix || '';
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((files, entry) => {
    const full = path.join(dir, entry.name);
    const relative = base ? base + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      return files.concat(listFiles(full, relative));
    }
    return files.concat([{ absolute: full, relative }]);
  }, []);
}

function removeDir(dir) {
  if (!fs.existsSync(dir)) { return; }
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

// The placeholder values in shared/build-info.js are replaced so the visual can
// report which build is actually loaded in Qlik.
function writeBuildInfo(targetFile) {
  const source = fs.readFileSync(path.join(SHARED_DIR, 'build-info.js'), 'utf8')
    .replace(/var VERSION = '[^']*';/, "var VERSION = '" + PKG_VERSION + "';")
    .replace(/var BUILT_AT = '[^']*';/, "var BUILT_AT = '" + BUILD_STAMP + "';");
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.writeFileSync(targetFile, source);
}

// Makes the build date visible in the QMC extension list as well as in-visual.
function stampQext(target, name) {
  const qextPath = path.join(target, name + '.qext');
  if (!fs.existsSync(qextPath)) { return; }
  const qext = JSON.parse(fs.readFileSync(qextPath, 'utf8'));
  qext.version = PKG_VERSION;
  qext.description = qext.description.replace(/\s*\(Build [^)]*\)$/, '') +
    ' (Build ' + BUILD_STAMP + ')';
  fs.writeFileSync(qextPath, JSON.stringify(qext, null, 2) + '\n');
}

function buildExtension(name) {
  const source = path.join(SRC_DIR, name);
  const target = path.join(DIST_DIR, name);
  removeDir(target);
  fs.mkdirSync(target, { recursive: true });

  listFiles(source).forEach((file) => {
    copyFile(file.absolute, path.join(target, file.relative));
  });

  SHARED_FILES.forEach((file) => {
    copyFile(path.join(SHARED_DIR, file), path.join(target, 'lib', file));
  });

  writeBuildInfo(path.join(target, 'lib', 'build-info.js'));
  stampQext(target, name);

  const entries = listFiles(target).map((file) => ({
    // Qlik expects the extension folder as the root of the archive
    name: name + '/' + file.relative,
    data: fs.readFileSync(file.absolute)
  }));

  const zipPath = path.join(DIST_DIR, name + '.zip');
  fs.writeFileSync(zipPath, createZip(entries));

  return { name, files: entries.length, zipPath };
}

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    throw new Error('src/ directory not found - run this script from the repository checkout');
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  const extensions = fs.readdirSync(SRC_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  extensions.forEach((name) => {
    const result = buildExtension(name);
    process.stdout.write(
      'Built ' + result.name + ' v' + PKG_VERSION + ' (' + BUILD_STAMP + ', ' +
      result.files + ' files) -> ' + path.relative(ROOT, result.zipPath) + '\n'
    );
  });

  process.stdout.write('\nImport the .zip files through the QMC: Extensions > Import.\n');
}

main();
