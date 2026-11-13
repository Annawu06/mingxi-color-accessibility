const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const settingsSource = fs.readFileSync(path.join(root, 'extension/core/settings.js'), 'utf8');
const contrastSource = fs.readFileSync(path.join(root, 'extension/core/contrast.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(settingsSource, context);
vm.runInContext(contrastSource, context);

test('settings reject unknown keys and unsafe mappings', () => {
  assert.throws(() => vm.runInContext('MingxiSettings.validateImport({global:{customMappings:[{from:"red",to:"#FFFFFF"}]}})', context));
  assert.throws(() => vm.runInContext('MingxiSettings.validateImport({global:{enabled:true,evil:"<script>"}})', context));
  assert.throws(() => vm.runInContext('MingxiSettings.validateImport({"site:example.com":{customMappings:Array(21).fill({from:"#000000",to:"#FFFFFF"})}})', context));
  assert.equal(vm.runInContext('MingxiSettings.effective({enabled:true},{mode:"contrast"}).mode', context), 'contrast');
  assert.equal(vm.runInContext('MingxiSettings.effective({enabled:true,readerMode:false}).enabled', context), true);
});

test('WCAG contrast known values', () => {
  assert.equal(vm.runInContext('MingxiContrast.contrastRatio([0,0,0],[255,255,255])', context), 21);
  assert.equal(vm.runInContext('MingxiContrast.contrastRatio([100,100,100],[100,100,100])', context), 1);
});

test('translucent backgrounds are composited', () => {
  const local = vm.createContext({ getComputedStyle: (node) => node.css });
  vm.runInContext(contrastSource, local);
  const result = vm.runInContext('MingxiContrast.backgroundFor({css:{backgroundColor:"rgba(255,255,255,0.5)",backgroundImage:"none",opacity:"1",mixBlendMode:"normal"},parentElement:{css:{backgroundColor:"rgb(0,0,0)",backgroundImage:"none",opacity:"1",mixBlendMode:"normal"},parentElement:null}})', local);
  assert(Math.abs(result[0] - 127.5) < 0.1);
});

test('Chart.js canvas exposes data and adds reversible patterns', () => {
  const listeners = {};
  let plugin;
  let inserted;
  let strokes = 0;
  let redraws = 0;
  let secondSeriesVisible = true;
  const element = () => ({
    children: [], dataset: {},
    appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    remove() { this.removed = true; }
  });
  const canvas = { isConnected: true, after(node) { inserted = node; node.previousElementSibling = canvas; } };
  const ctx = Object.fromEntries(['save', 'restore', 'beginPath', 'rect', 'clip', 'moveTo', 'lineTo', 'setLineDash'].map((name) => [name, () => {}]));
  ctx.stroke = () => { strokes++; };
  const chart = {
    canvas, ctx, chartArea: { left: 0, top: 0, right: 200, bottom: 100 },
    data: { labels: ['一月'], datasets: [{ label: '苹果', data: [12] }, { label: '橙子', data: [24] }] },
    scales: { x: { id: 'x', axis: 'x', options: { title: { text: '月份' } } }, y: { id: 'y', axis: 'y', options: { title: { text: '销量' } } } },
    getDatasetMeta(index) { return { type: 'bar', iScale: { axis: 'x' }, data: [{ x: 40 + index * 40, y: 20, base: 90, width: 20, height: 70 }] }; },
    isDatasetVisible(index) { return index === 0 || secondSeriesVisible; },
    update() { plugin.afterUpdate(this); plugin.afterDatasetsDraw(this); },
    draw() { redraws++; }
  };
  const chartLibrary = { register(value) { plugin = value; }, getChart(node) { return node === canvas ? chart : undefined; } };
  const local = vm.createContext({
    window: { Chart: chartLibrary, addEventListener(name, listener) { listeners[name] = listener; } },
    document: { querySelectorAll: () => [canvas], createElement: element },
    setInterval, clearInterval
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'extension/canvas-chart.js'), 'utf8'), local);
  listeners['mingxi-chart-enable']();
  assert(strokes >= 2);
  assert.match(inserted.children[0].textContent, /苹果、橙子.*月份.*销量/);
  assert.equal(inserted.children[1].children[1].children[2].textContent, '12');
  secondSeriesVisible = false;
  const beforeHidden = strokes;
  chart.update();
  assert.equal(strokes, beforeHidden);
  assert.equal(inserted.removed, true);
  secondSeriesVisible = true;
  chart.update();
  assert.equal(inserted.removed, undefined);
  listeners['mingxi-chart-disable']();
  assert.equal(inserted.removed, true);
  assert.equal(redraws, 1);
});

test('extension update does not overwrite preferences', async () => {
  let installed;
  let writes = 0;
  const event = () => ({ addListener() {} });
  const fakeChrome = {
    contextMenus: { removeAll: async () => {}, create() {}, onClicked: event() },
    runtime: { onInstalled: { addListener(listener) { installed = listener; } }, onStartup: event(), getURL: (value) => value },
    storage: { sync: { get: async () => ({}), set: async () => { writes++; } }, onChanged: event() },
    tabs: { create() {}, onUpdated: event(), onActivated: event() },
    commands: { onCommand: event() }
  };
  const local = vm.createContext({ chrome: fakeChrome, importScripts() {}, MingxiSettings: vm.runInContext('MingxiSettings', context) });
  vm.runInContext(fs.readFileSync(path.join(root, 'extension/background.js'), 'utf8'), local);
  installed({ reason: 'update' });
  assert.equal(writes, 0);
  installed({ reason: 'install' });
  await new Promise(setImmediate);
  assert.equal(writes, 1);
  fakeChrome.storage.sync.get = async () => ({ global: { enabled: true } });
  installed({ reason: 'install' });
  await new Promise(setImmediate);
  assert.equal(writes, 1);
});

test('browser restores SVG and contrast changes', (t) => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mingxi-chrome-'));
  t.after(() => fs.rmSync(profile, { recursive: true, force: true }));
  const chrome = spawnSync('google-chrome', [
    '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--user-data-dir=${profile}`,
    '--virtual-time-budget=1500', '--dump-dom',
    `file://${path.join(root, 'tests/fixtures/extension.html')}`
  ], { encoding: 'utf8', timeout: 15000 });
  if (chrome.error?.code === 'ENOENT') { if (process.env.CI) assert.fail('Google Chrome is required in CI'); t.skip('Google Chrome is unavailable'); return; }
  if (chrome.signal && chrome.stderr.includes('Operation not permitted')) { if (process.env.CI) assert.fail('Chrome is blocked in CI'); t.skip('Chrome is blocked by this sandbox'); return; }
  if (chrome.error) assert.fail(`Chrome failed: ${chrome.error.message}\n${chrome.stderr.slice(-1000)}`);
  assert.equal(chrome.status, 0, chrome.stderr.slice(-1000));
  const result = chrome.stdout.match(/<body[^>]*data-test-status="([^"]*)"/)?.[1];
  assert.equal(result, 'pass', `Browser fixture: ${result || 'no result'}\n${chrome.stderr.slice(-1000)}`);
});
