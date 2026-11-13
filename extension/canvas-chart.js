(() => {
  let enabled = false;
  let chartLibrary;
  let pollTimer;
  const summaries = new WeakMap();
  const plugin = {
    id: 'mingxiCanvasHints',
    afterUpdate(chart) {
      if (enabled) updateSummary(chart);
    },
    afterDatasetsDraw(chart) {
      if (enabled) drawPatterns(chart);
    },
    afterDestroy(chart) {
      summaries.get(chart)?.remove();
      summaries.delete(chart);
    }
  };

  function charts() {
    if (!chartLibrary?.getChart) return [];
    return [...document.querySelectorAll('canvas')]
      .map((canvas) => chartLibrary.getChart(canvas))
      .filter(Boolean);
  }

  function install() {
    if (!enabled || chartLibrary) return;
    const library = window.Chart;
    if (typeof library?.register !== 'function' || typeof library?.getChart !== 'function') return;
    chartLibrary = library;
    clearInterval(pollTimer);
    pollTimer = undefined;
    library.register(plugin);
    charts().forEach((chart) => chart.update('none'));
  }

  function visibleDatasets(chart) {
    return (chart.data?.datasets || []).map((dataset, index) => ({ dataset, index, meta:chart.getDatasetMeta(index) }))
      .filter(({ index, meta }) => chart.isDatasetVisible(index) && (meta?.type === 'bar' || meta?.type === 'line') && meta.data?.length);
  }

  function drawPatterns(chart) {
    const datasets = visibleDatasets(chart);
    if (datasets.length < 2) return;
    const { ctx, chartArea } = chart;
    if (!ctx || !chartArea) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
    ctx.clip();
    datasets.forEach(({ meta }, seriesIndex) => {
      if (meta.type === 'bar') {
        meta.data.forEach((bar) => {
          if (bar.skip) return;
          const horizontal = meta.iScale?.axis === 'y';
          const rawLeft = horizontal ? Math.min(bar.base, bar.x) : bar.x - bar.width / 2;
          const rawTop = horizontal ? bar.y - bar.height / 2 : Math.min(bar.base, bar.y);
          const rawRight = rawLeft + (horizontal ? Math.abs(bar.x - bar.base) : bar.width);
          const rawBottom = rawTop + (horizontal ? bar.height : Math.abs(bar.y - bar.base));
          const left = Math.max(rawLeft, chartArea.left);
          const top = Math.max(rawTop, chartArea.top);
          const width = Math.min(rawRight, chartArea.right) - left;
          const height = Math.min(rawBottom, chartArea.bottom) - top;
          if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;
          ctx.save();
          ctx.beginPath();
          ctx.rect(left, top, width, height);
          ctx.clip();
          ctx.beginPath();
          const gap = 8;
          for (let x = left - height; x < left + width + height; x += gap) {
            ctx.moveTo(x, top + height);
            ctx.lineTo(x + (seriesIndex % 2 ? -height : height), top);
          }
          ctx.strokeStyle = 'rgba(0,0,0,.65)';
          ctx.lineWidth = 1.3;
          ctx.stroke();
          ctx.restore();
        });
      } else if (meta.type === 'line') {
        ctx.save();
        ctx.beginPath();
        let started = false;
        for (const point of meta.data) {
          if (point.skip || !Number.isFinite(point.x) || !Number.isFinite(point.y)) { started = false; continue; }
          if (started) ctx.lineTo(point.x, point.y);
          else ctx.moveTo(point.x, point.y);
          started = true;
        }
        ctx.strokeStyle = 'rgba(0,0,0,.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash(seriesIndex % 2 ? [3, 4] : [8, 4]);
        ctx.stroke();
        ctx.restore();
      }
    });
    ctx.restore();
  }

  function pointCells(point, label) {
    if (Array.isArray(point) && point.length === 2) return point;
    if (point && typeof point === 'object') return [point.x ?? label, point.y ?? point.value ?? ''];
    return [label, point ?? ''];
  }

  function updateSummary(chart) {
    const canvas = chart.canvas;
    if (!canvas?.isConnected) return;
    const datasets = visibleDatasets(chart);
    let details = summaries.get(chart);
    if (datasets.length < 2) {
      details?.remove();
      summaries.delete(chart);
      return;
    }
    if (!details) {
      details = document.createElement('details');
      details.dataset.mingxiCanvasSummary = 'true';
      summaries.set(chart, details);
    }
    const scales = Object.values(chart.scales || {}).filter((scale) => scale.axis === 'x' || scale.axis === 'y');
    const axes = scales.map((scale) => `${scale.axis.toUpperCase()}：${scale.options?.title?.text || scale.id}`).join('；');
    const summary = document.createElement('summary');
    summary.textContent = `图表数据：${datasets.map(({ dataset, index }) => dataset.label || `系列 ${index + 1}`).join('、')}${axes ? `；坐标轴 ${axes}` : ''}`;
    const table = document.createElement('table');
    const header = document.createElement('tr');
    for (const title of ['系列', '坐标', '数值']) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = title;
      header.appendChild(cell);
    }
    table.appendChild(header);
    let count = 0;
    for (const { dataset, index } of datasets) {
      for (const [pointIndex, point] of (dataset.data || []).entries()) {
        if (count++ >= 300) break;
        const row = document.createElement('tr');
        const label = chart.data.labels?.[pointIndex] ?? pointIndex + 1;
        const [coordinate, value] = pointCells(point, label);
        for (const cellValue of [dataset.label || `系列 ${index + 1}`, coordinate, value]) {
          const cell = document.createElement('td');
          cell.textContent = String(cellValue);
          row.appendChild(cell);
        }
        table.appendChild(row);
      }
      if (count >= 300) break;
    }
    details.replaceChildren(summary, table);
    if (count >= 300) {
      const note = document.createElement('p');
      note.textContent = '仅显示前 300 个数据点。';
      details.appendChild(note);
    }
    if (details.previousElementSibling !== canvas) canvas.after(details);
  }

  window.addEventListener('mingxi-chart-enable', () => {
    enabled = true;
    const wasInstalled = Boolean(chartLibrary);
    install();
    if (!chartLibrary && !pollTimer) pollTimer = setInterval(install, 500);
    if (wasInstalled) charts().forEach((chart) => chart.update('none'));
  });
  window.addEventListener('mingxi-chart-disable', () => {
    enabled = false;
    clearInterval(pollTimer);
    pollTimer = undefined;
    charts().forEach((chart) => {
      summaries.get(chart)?.remove();
      summaries.delete(chart);
      chart.draw();
    });
  });
})();
