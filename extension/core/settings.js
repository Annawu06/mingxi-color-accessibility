(() => {
  const defaults = Object.freeze({
    enabled: false, mode: 'deuteranopia', intensity: 65, fontScale: 100,
    focusHints: true, semanticHints: true, enhanceImages: true,
    autoContrast: true, chartHints: true, linkHints: true,
    requiredHints: true, colorRemap: true, excluded: false,
    customMappings: []
  });
  const modes = new Set(['protanopia', 'deuteranopia', 'tritanopia', 'contrast']);
  const keys = new Set(Object.keys(defaults));
  const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
  const hex = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

  function validate(value) {
    if (!plain(value)) throw new Error('Settings must be an object');
    const result = {};
    for (const [key, field] of Object.entries(value)) {
      if (!keys.has(key)) throw new Error(`Unknown setting: ${key}`);
      if (key === 'mode' && !modes.has(field)) throw new Error('Invalid mode');
      if (key === 'intensity' && (!Number.isInteger(field) || field < 0 || field > 100)) throw new Error('Invalid intensity');
      if (key === 'fontScale' && (!Number.isInteger(field) || field < 100 || field > 160)) throw new Error('Invalid font size');
      if (key === 'customMappings') {
        if (!Array.isArray(field) || field.length > 20 || field.some((rule) => !plain(rule) || Object.keys(rule).length !== 2 || !hex(rule.from) || !hex(rule.to))) throw new Error('Invalid color mappings');
        result[key] = field.map(({ from, to }) => ({ from:from.toUpperCase(), to:to.toUpperCase() }));
        continue;
      }
      if (!['mode', 'intensity', 'fontScale', 'customMappings'].includes(key) && typeof field !== 'boolean') throw new Error(`Invalid ${key}`);
      result[key] = field;
    }
    return result;
  }

  function stored(value) {
    if (!plain(value)) return {};
    return validate(Object.fromEntries(Object.entries(value).filter(([key]) => keys.has(key))));
  }

  function effective(global, site) {
    return { ...defaults, customMappings: [], ...stored(global), ...stored(site) };
  }

  function validateImport(value) {
    if (!plain(value) || !Object.keys(value).length || Object.keys(value).length > 101) throw new Error('Invalid settings file');
    const result = {};
    for (const [key, settings] of Object.entries(value)) {
      if (key !== 'global' && !/^site:[a-z0-9.:[\]-]{1,253}$/i.test(key)) throw new Error('Invalid site key');
      result[key] = validate(settings);
    }
    return result;
  }

  globalThis.MingxiSettings = Object.freeze({ defaults, effective, validate, validateImport, stored, hex });
})();
