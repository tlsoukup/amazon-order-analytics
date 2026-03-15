// ══════════════════════════════════════════
// Theme Toggle
// ══════════════════════════════════════════
(function(){
  const t = document.querySelector('[data-theme-toggle]');
  const r = document.documentElement;
  let d = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  r.setAttribute('data-theme', d);
  if (t) t.addEventListener('click', () => {
    d = d === 'dark' ? 'light' : 'dark';
    r.setAttribute('data-theme', d);
    t.innerHTML = d === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    if (DATA) rebuildCharts();
  });
})();

// ══════════════════════════════════════════
// Chart Colors & Defaults
// ══════════════════════════════════════════
const CHART_COLORS = [
  '#e47911', '#1a73e8', '#0e9aa7', '#0f9d58', '#7c3aed',
  '#db2777', '#dc2626', '#eab308', '#4f46e5', '#06b6d4',
  '#059669', '#d97706'
];

function getChartDefaults() {
  const style = getComputedStyle(document.documentElement);
  return {
    text: style.getPropertyValue('--color-text').trim(),
    muted: style.getPropertyValue('--color-text-muted').trim(),
    faint: style.getPropertyValue('--color-text-faint').trim(),
    border: style.getPropertyValue('--color-border').trim(),
    surface: style.getPropertyValue('--color-surface').trim(),
    primary: style.getPropertyValue('--color-primary').trim(),
    bg: style.getPropertyValue('--color-bg').trim(),
  };
}

// ══════════════════════════════════════════
// Data & State
// ══════════════════════════════════════════
let DATA = null;
let activeYear = 'all';
let monthlyView = 'spend';
let charts = {};
let snsMonthlyView = 'spend';

const fmt = n => '$' + n.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
const fmtDec = n => '$' + n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

// ══════════════════════════════════════════
// Upload Page Logic
// ══════════════════════════════════════════
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileListEl = document.getElementById('fileList');
const analyzeBtn = document.getElementById('analyzeBtn');
const errorToast = document.getElementById('errorToast');
const processingOverlay = document.getElementById('processingOverlay');
const howToSection = document.getElementById('howToSection');
const howToToggle = document.getElementById('howToToggle');
const btnUploadNew = document.getElementById('btnUploadNew');

let uploadedFiles = []; // Array of { name, file }

// Drop zone events
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => {
  handleFiles(fileInput.files);
  fileInput.value = '';
});

// How-to toggle
howToToggle.addEventListener('click', () => {
  howToSection.classList.toggle('open');
});

// Upload new data button
btnUploadNew.addEventListener('click', () => {
  showUploadView();
});

// Handle file selection
function handleFiles(files) {
  hideError();
  for (const file of files) {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.zip') && !name.endsWith('.csv')) {
      showError('Please upload .zip or .csv files only.');
      continue;
    }
    // Check for duplicates
    if (uploadedFiles.some(f => f.name === file.name && f.file.size === file.size)) continue;
    uploadedFiles.push({ name: file.name, file });
  }
  renderFileList();
  updateAnalyzeBtn();
}

function renderFileList() {
  if (uploadedFiles.length === 0) {
    fileListEl.innerHTML = '';
    return;
  }
  fileListEl.innerHTML = uploadedFiles.map((f, i) => {
    const isZip = f.name.toLowerCase().endsWith('.zip');
    const sizeKB = (f.file.size / 1024).toFixed(1);
    const sizeMB = (f.file.size / (1024 * 1024)).toFixed(1);
    const sizeLabel = f.file.size > 1048576 ? `${sizeMB} MB` : `${sizeKB} KB`;
    return `
      <div class="file-item">
        <div class="file-item-icon ${isZip ? 'zip' : ''}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${isZip
              ? '<path d="M21 8v13H3V3h13l5 5z"/><path d="M13 3v5h5"/>'
              : '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'
            }
          </svg>
        </div>
        <span class="file-item-name">${escapeHtml(f.name)}</span>
        <span class="file-item-size">${sizeLabel}</span>
        <button class="file-item-remove" data-index="${i}" aria-label="Remove file">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;
  }).join('');

  fileListEl.querySelectorAll('.file-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      uploadedFiles.splice(idx, 1);
      renderFileList();
      updateAnalyzeBtn();
    });
  });
}

function updateAnalyzeBtn() {
  analyzeBtn.disabled = uploadedFiles.length === 0;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showError(msg) {
  errorToast.textContent = msg;
  errorToast.classList.add('active');
}
function hideError() {
  errorToast.classList.remove('active');
}

// ── Analyze button click ──
analyzeBtn.addEventListener('click', async () => {
  hideError();
  processingOverlay.classList.add('active');

  try {
    // Collect all CSV file contents
    const csvFiles = new Map();

    for (const entry of uploadedFiles) {
      const name = entry.name.toLowerCase();

      if (name.endsWith('.zip')) {
        // Extract zip
        const arrayBuffer = await entry.file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        // Look for CSV files in the zip
        const zipEntries = Object.entries(zip.files);
        for (const [path, zipEntry] of zipEntries) {
          if (zipEntry.dir) continue;
          const fileName = path.split('/').pop();
          if (!fileName.toLowerCase().endsWith('.csv')) continue;

          // Map known filenames
          if (fileName === 'Order History.csv' || fileName === 'Retail.OrderHistory.1.csv') {
            csvFiles.set('Order History.csv', await zipEntry.async('string'));
          } else if (fileName === 'Digital Content Orders.csv' || fileName === 'Digital.OrderHistory.1.csv') {
            csvFiles.set('Digital Content Orders.csv', await zipEntry.async('string'));
          } else if (fileName === 'Refund Details.csv' || fileName === 'Returns.Refund.1.csv') {
            csvFiles.set('Refund Details.csv', await zipEntry.async('string'));
          }
        }
      } else if (name.endsWith('.csv')) {
        // Individual CSV file
        const text = await entry.file.text();
        // Map by filename
        if (name.includes('order history') || name === 'order history.csv') {
          csvFiles.set('Order History.csv', text);
        } else if (name.includes('digital') || name === 'digital content orders.csv') {
          csvFiles.set('Digital Content Orders.csv', text);
        } else if (name.includes('refund') || name === 'refund details.csv') {
          csvFiles.set('Refund Details.csv', text);
        } else {
          // Try to auto-detect by headers
          const firstLine = text.split('\n')[0].toLowerCase();
          if (firstLine.includes('unit price') && firstLine.includes('product name')) {
            csvFiles.set('Order History.csv', text);
          } else if (firstLine.includes('component type') || firstLine.includes('transaction amount')) {
            csvFiles.set('Digital Content Orders.csv', text);
          } else if (firstLine.includes('refund')) {
            csvFiles.set('Refund Details.csv', text);
          }
        }
      }
    }

    if (csvFiles.size === 0) {
      throw new Error('No recognized Amazon CSV files found. Please upload your Amazon data export (.zip) or individual CSV files.');
    }

    // Process data using parser.js
    // Use setTimeout to allow the UI to update
    await new Promise(resolve => setTimeout(resolve, 50));
    const data = window.processAmazonData(csvFiles);

    DATA = data;
    showDashboardView();
    init();

  } catch (err) {
    showError(err.message || 'An error occurred while processing your files.');
  } finally {
    processingOverlay.classList.remove('active');
  }
});

// ── View switching ──
function showUploadView() {
  document.body.classList.remove('state-dashboard');
  document.body.classList.add('state-upload');
  // Reset state
  uploadedFiles = [];
  renderFileList();
  updateAnalyzeBtn();
  hideError();
  // Destroy charts
  destroyAll();
  DATA = null;
  activeYear = 'all';
  monthlyView = 'spend';
}

function showDashboardView() {
  document.body.classList.remove('state-upload');
  document.body.classList.add('state-dashboard');
}

// ══════════════════════════════════════════
// Dashboard Logic (adapted from existing app.js)
// ══════════════════════════════════════════

function init() {
  buildYearFilter();
  buildKPIs();
  buildAllCharts();
  buildTable(DATA.top_items);
  document.getElementById('orderCount').textContent = DATA.summary.total_items.toLocaleString();
  setupSearch();
  setupMonthlyToggle();
  setupSnsMonthlyToggle();
}

// ── Year Filter ──
function buildYearFilter() {
  const container = document.getElementById('yearFilter');
  const years = DATA.yearly.map(y => y.year).filter(y => y >= 2010);
  let html = `<button class="year-btn active" data-year="all">All</button>`;
  years.forEach(y => {
    html += `<button class="year-btn" data-year="${y}">${y}</button>`;
  });
  container.innerHTML = html;
  container.querySelectorAll('.year-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeYear = btn.dataset.year;
      rebuildCharts();
    });
  });
}

// ── KPIs ──
function buildKPIs() {
  if (activeYear === 'all') {
    const s = DATA.summary;
    const netSpend = s.total_spend - s.total_refunds;
    const kpis = [
      { label: 'Net Spent', value: fmt(netSpend), sub: `${fmt(s.total_spend)} gross − ${fmt(s.total_refunds)} refunds` },
      { label: 'Total Items', value: s.total_items.toLocaleString(), sub: `${s.unique_orders.toLocaleString()} orders` },
      { label: 'Avg Order', value: fmtDec(s.avg_order_value), sub: 'per unique order' },
      { label: 'Total Refunds', value: fmt(s.total_refunds), sub: `${s.refund_count} refunds` },
      { label: 'Biggest Purchase', value: fmtDec(s.most_expensive_price), sub: s.most_expensive_item.substring(0, 45) + (s.most_expensive_item.length > 45 ? '...' : '') },
      { label: 'Avg Monthly', value: fmt(DATA.monthly.length > 0 ? netSpend / DATA.monthly.length : 0), sub: `over ${DATA.monthly.length} months` },
      { label: 'Subscribe & Save', value: fmt(DATA.subscribe_save.total_spend), sub: `${DATA.subscribe_save.total_count.toLocaleString()} orders · ${DATA.subscribe_save.pct_of_total}% of total` },
    ];
    renderKPIs(kpis);
  } else {
    const filtered = DATA.all_orders.filter(o => o.date.startsWith(activeYear));
    const totalSpend = filtered.reduce((s, o) => s + o.total, 0);
    const months = DATA.monthly.filter(m => m.month.startsWith(activeYear));
    const refunds = DATA.refund_by_year.find(r => r.year === parseInt(activeYear));
    const refundAmt = refunds ? refunds.amount : 0;
    const netSpend = totalSpend - refundAmt;
    const topItem = filtered.reduce((max, o) => o.total > max.total ? o : max, {total: 0, product: ''});
    const kpis = [
      { label: 'Net Spent', value: fmt(netSpend), sub: `${fmt(totalSpend)} gross − ${fmt(refundAmt)} refunds` },
      { label: 'Items Ordered', value: filtered.length.toLocaleString(), sub: `in ${activeYear}` },
      { label: 'Avg/Month', value: fmt(months.length ? netSpend / months.length : 0), sub: `${months.length} months` },
      { label: 'Refunds', value: fmt(refundAmt), sub: `in ${activeYear}` },
      { label: 'Biggest Purchase', value: fmtDec(topItem.total), sub: topItem.product.substring(0, 45) + (topItem.product.length > 45 ? '...' : '') },
      { label: 'Subscribe & Save', value: (() => { const snsFiltered = DATA.all_orders.filter(o => o.date.startsWith(activeYear) && o.is_sns); return fmt(snsFiltered.reduce((s, o) => s + o.total, 0)); })(), sub: (() => { const snsFiltered = DATA.all_orders.filter(o => o.date.startsWith(activeYear) && o.is_sns); return `${snsFiltered.length} orders`; })() },
      { label: 'Top Category', value: (() => { const cats = {}; filtered.forEach(o => cats[o.category] = (cats[o.category]||0) + o.total); return Object.entries(cats).sort((a,b) => b[1]-a[1])[0]?.[0] || 'N/A'; })(), sub: (() => { const cats = {}; filtered.forEach(o => cats[o.category] = (cats[o.category]||0) + o.total); const top = Object.entries(cats).sort((a,b) => b[1]-a[1])[0]; return top ? fmt(top[1]) : ''; })() },
    ];
    renderKPIs(kpis);
  }
}

function renderKPIs(kpis) {
  document.getElementById('kpiRow').innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <span class="kpi-label">${k.label}</span>
      <span class="kpi-value">${k.value}</span>
      <span class="kpi-sub">${k.sub}</span>
    </div>
  `).join('');
}

// ── Chart Builders ──
function destroyAll() {
  Object.values(charts).forEach(c => c && c.destroy());
  charts = {};
}

function rebuildCharts() {
  destroyAll();
  buildKPIs();
  buildAllCharts();
}

function buildAllCharts() {
  const c = getChartDefaults();
  Chart.defaults.font.family = "'General Sans', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = c.muted;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = c.text;
  Chart.defaults.plugins.tooltip.titleColor = c.surface;
  Chart.defaults.plugins.tooltip.bodyColor = c.surface;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.titleFont = { weight: '600', size: 12 };
  Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
  Chart.defaults.elements.bar.borderRadius = 4;
  // CRITICAL: Set individual properties, not object literals
  Chart.defaults.scale.grid.color = c.border + '33';
  Chart.defaults.scale.border.display = false;

  buildMonthlyChart(c);
  buildYearlyChart(c);
  buildCategoryChart(c);
  buildTypeChart(c);
  buildDowChart(c);
  buildHourChart(c);
  buildRefundChart(c);
  buildRefundReasonChart(c);
  buildSnsMonthlyChart(c);
  buildSnsYearlyChart(c);
  buildSnsProductsTable();
  buildSnsBadge();
}

function buildMonthlyChart(c) {
  let data = activeYear === 'all'
    ? DATA.monthly
    : DATA.monthly.filter(m => m.month.startsWith(activeYear));

  const labels = data.map(d => {
    const [y,m] = d.month.split('-');
    if (data.length > 48) return m === '01' ? y : '';
    return `${['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m)]} '${y.slice(2)}`;
  });

  const isSpend = monthlyView === 'spend';
  const values = data.map(d => isSpend ? d.spend : d.count);
  const useLineChart = data.length > 24;

  const canvas = document.getElementById('monthlyChart');
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 280);
  gradient.addColorStop(0, c.primary + '55');
  gradient.addColorStop(1, c.primary + '05');

  if (useLineChart) {
    charts.monthly = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: c.primary,
          borderWidth: 2,
          backgroundColor: gradient,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHitRadius: 8,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: c.primary,
          pointHoverBorderColor: c.surface,
          pointHoverBorderWidth: 2,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => data[items[0].dataIndex].month,
              label: (item) => isSpend ? fmtDec(item.raw) : `${item.raw} items`
            }
          }
        },
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 20 } },
          y: {
            beginAtZero: true,
            ticks: { callback: v => isSpend ? '$' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v) : v }
          }
        }
      }
    });
  } else {
    charts.monthly = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: c.primary + 'bb',
          hoverBackgroundColor: c.primary,
          borderSkipped: false,
          barPercentage: 0.8,
          categoryPercentage: 0.9,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => data[items[0].dataIndex].month,
              label: (item) => isSpend ? fmtDec(item.raw) : `${item.raw} items`
            }
          }
        },
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 14 } },
          y: {
            beginAtZero: true,
            ticks: { callback: v => isSpend ? '$' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v) : v }
          }
        }
      }
    });
  }
}

function buildYearlyChart(c) {
  let data = DATA.yearly.filter(y => y.year >= 2010);
  if (activeYear !== 'all') data = data.filter(y => y.year === parseInt(activeYear));

  charts.yearly = new Chart(document.getElementById('yearlyChart'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.year),
      datasets: [{
        data: data.map(d => d.spend),
        backgroundColor: data.map((d,i) =>
          activeYear !== 'all' ? c.primary : CHART_COLORS[i % CHART_COLORS.length] + 'cc'
        ),
        hoverBackgroundColor: data.map((d,i) =>
          activeYear !== 'all' ? c.primary : CHART_COLORS[i % CHART_COLORS.length]
        ),
        barPercentage: 0.7,
        categoryPercentage: 0.85,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        tooltip: {
          callbacks: { label: item => fmtDec(item.raw) + ` (${data[item.dataIndex].count} items)` }
        }
      },
      scales: {
        x: { beginAtZero: true, ticks: { callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v) } },
        y: { ticks: { font: { size: 11 } } }
      }
    }
  });
}

function buildCategoryChart(c) {
  let catData = DATA.categories;
  if (activeYear !== 'all') {
    const catMap = {};
    DATA.all_orders.filter(o => o.date.startsWith(activeYear)).forEach(o => {
      catMap[o.category] = (catMap[o.category] || 0) + o.total;
    });
    catData = Object.entries(catMap).map(([name, spend]) => ({name, spend})).sort((a,b) => b.spend - a.spend);
  }

  const legendEl = document.getElementById('categoryLegend');
  legendEl.innerHTML = catData.map((d,i) => `
    <span class="legend-item">
      <span class="legend-dot" style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></span>
      ${d.name} (${fmt(d.spend)})
    </span>
  `).join('');

  charts.category = new Chart(document.getElementById('categoryChart'), {
    type: 'doughnut',
    data: {
      labels: catData.map(d => d.name),
      datasets: [{
        data: catData.map(d => d.spend),
        backgroundColor: catData.map((d,i) => CHART_COLORS[i % CHART_COLORS.length] + 'dd'),
        hoverBackgroundColor: catData.map((d,i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 2,
        borderColor: c.surface,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        tooltip: {
          callbacks: { label: item => ` ${item.label}: ${fmtDec(item.raw)}` }
        }
      }
    }
  });
}

function buildTypeChart(c) {
  let typeData = DATA.order_types;
  if (activeYear !== 'all') {
    const typeMap = {};
    DATA.all_orders.filter(o => o.date.startsWith(activeYear)).forEach(o => {
      typeMap[o.type] = (typeMap[o.type] || 0) + o.total;
    });
    typeData = Object.entries(typeMap).map(([type, spend]) => ({type, spend})).sort((a,b) => b.spend - a.spend);
  }

  const typeLabels = { physical: 'Physical', digital: 'Digital', audible: 'Audible', subscription: 'Subscription' };
  charts.type = new Chart(document.getElementById('typeChart'), {
    type: 'doughnut',
    data: {
      labels: typeData.map(d => typeLabels[d.type] || d.type),
      datasets: [{
        data: typeData.map(d => d.spend),
        backgroundColor: [c.primary + 'dd', CHART_COLORS[1] + 'dd', CHART_COLORS[2] + 'dd', CHART_COLORS[4] + 'dd'],
        hoverBackgroundColor: [c.primary, CHART_COLORS[1], CHART_COLORS[2], CHART_COLORS[4]],
        borderWidth: 2,
        borderColor: c.surface,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { display: true, position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } },
        tooltip: {
          callbacks: { label: item => ` ${item.label}: ${fmtDec(item.raw)}` }
        }
      }
    }
  });
}

function buildDowChart(c) {
  let data = DATA.day_of_week;
  if (activeYear !== 'all') {
    const dowMap = {};
    DATA.all_orders.filter(o => o.date.startsWith(activeYear)).forEach(o => {
      const d = new Date(o.date);
      const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getUTCDay()];
      dowMap[day] = (dowMap[day] || 0) + o.total;
    });
    data = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => ({day: d, spend: dowMap[d] || 0}));
  }

  charts.dow = new Chart(document.getElementById('dowChart'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.day.substring(0,3)),
      datasets: [{
        data: data.map(d => d.spend),
        backgroundColor: data.map((d,i) => CHART_COLORS[i] + 'cc'),
        hoverBackgroundColor: data.map((d,i) => CHART_COLORS[i]),
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        tooltip: { callbacks: { label: item => fmtDec(item.raw) } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v) } }
      }
    }
  });
}

function buildHourChart(c) {
  let data = DATA.hour_of_day;

  const gradient = document.getElementById('hourChart').getContext('2d');
  const g = gradient.createLinearGradient(0, 0, 0, 280);
  g.addColorStop(0, c.primary + '88');
  g.addColorStop(1, c.primary + '11');

  charts.hour = new Chart(document.getElementById('hourChart'), {
    type: 'line',
    data: {
      labels: data.map(d => `${d.hour}:00`),
      datasets: [{
        data: data.map(d => d.count),
        borderColor: c.primary,
        borderWidth: 2,
        backgroundColor: g,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: c.primary,
        pointBorderColor: c.surface,
        pointBorderWidth: 2,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            title: items => `${items[0].label} UTC`,
            label: item => `${item.raw} orders`
          }
        }
      },
      scales: {
        x: { ticks: { maxTicksLimit: 12 } },
        y: { beginAtZero: true }
      }
    }
  });
}

function buildRefundChart(c) {
  let data = DATA.refund_by_year.filter(r => r.year >= 2010);

  charts.refund = new Chart(document.getElementById('refundChart'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.year),
      datasets: [{
        data: data.map(d => d.amount),
        backgroundColor: '#dc2626' + '99',
        hoverBackgroundColor: '#dc2626',
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        tooltip: { callbacks: { label: item => fmtDec(item.raw) } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(1) + 'k' : v) } }
      }
    }
  });
}

function buildRefundReasonChart(c) {
  const data = DATA.refund_reasons;
  if (!data || data.length === 0) {
    // No refund data — show empty state
    const canvas = document.getElementById('refundReasonChart');
    const ctx = canvas.getContext('2d');
    charts.refundReason = new Chart(canvas, {
      type: 'doughnut',
      data: { labels: ['No refunds'], datasets: [{ data: [1], backgroundColor: [c.border + '44'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { display: false } } }
    });
    return;
  }
  charts.refundReason = new Chart(document.getElementById('refundReasonChart'), {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.reason),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: ['#dc2626cc', '#e4791199', '#1a73e899', '#0f9d5899'],
        hoverBackgroundColor: ['#dc2626', '#e47911', '#1a73e8', '#0f9d58'],
        borderWidth: 2,
        borderColor: c.surface,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: { display: true, position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } },
        tooltip: { callbacks: { label: item => ` ${item.label}: ${item.raw}` } }
      }
    }
  });
}

// ── S&S Charts ──
function buildSnsBadge() {
  const badge = document.getElementById('snsBadge');
  if (!badge) return;
  const sns = DATA.subscribe_save;
  badge.textContent = `${fmt(sns.total_spend)} · ${sns.total_count.toLocaleString()} orders · ${sns.pct_of_total}% of spending`;
}

function buildSnsMonthlyChart(c) {
  const sns = DATA.subscribe_save;
  let data = sns.monthly;
  if (activeYear !== 'all') {
    data = data.filter(m => m.month.startsWith(activeYear));
  }
  if (data.length === 0) {
    charts.snsMonthly = new Chart(document.getElementById('snsMonthlyChart'), {
      type: 'bar',
      data: { labels: ['No data'], datasets: [{ data: [0], backgroundColor: [c.border + '44'] }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
    return;
  }

  const isSpend = snsMonthlyView === 'spend';
  const values = data.map(d => isSpend ? d.spend : d.count);
  const labels = data.map(d => {
    const [y, m] = d.month.split('-');
    if (data.length > 48) return m === '01' ? y : '';
    return `${['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m)]} '${y.slice(2)}`;
  });
  const useLineChart = data.length > 24;
  const fmtAxis = v => isSpend ? '$' + (v >= 1000 ? (v/1000).toFixed(1) + 'k' : v) : v;

  const canvas = document.getElementById('snsMonthlyChart');
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 280);
  gradient.addColorStop(0, '#0e9aa7' + '55');
  gradient.addColorStop(1, '#0e9aa7' + '05');

  if (useLineChart) {
    charts.snsMonthly = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: '#0e9aa7',
          borderWidth: 2,
          backgroundColor: gradient,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHitRadius: 8,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#0e9aa7',
          pointHoverBorderColor: c.surface,
          pointHoverBorderWidth: 2,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => data[items[0].dataIndex].month,
              label: (item) => isSpend ? fmtDec(item.raw) : `${item.raw} items`
            }
          }
        },
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 20 } },
          y: { beginAtZero: true, ticks: { callback: fmtAxis } }
        }
      }
    });
  } else {
    charts.snsMonthly = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: '#0e9aa7' + 'bb',
          hoverBackgroundColor: '#0e9aa7',
          borderSkipped: false,
          barPercentage: 0.8,
          categoryPercentage: 0.9,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => data[items[0].dataIndex].month,
              label: (item) => isSpend ? fmtDec(item.raw) : `${item.raw} items`
            }
          }
        },
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 14 } },
          y: { beginAtZero: true, ticks: { callback: fmtAxis } }
        }
      }
    });
  }
}

function buildSnsYearlyChart(c) {
  let data = DATA.subscribe_save.by_year.filter(y => y.year >= 2010);
  if (activeYear !== 'all') data = data.filter(y => y.year === parseInt(activeYear));

  if (data.length === 0) {
    charts.snsYearly = new Chart(document.getElementById('snsYearlyChart'), {
      type: 'bar',
      data: { labels: ['No data'], datasets: [{ data: [0], backgroundColor: [c.border + '44'] }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
    return;
  }

  charts.snsYearly = new Chart(document.getElementById('snsYearlyChart'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.year),
      datasets: [{
        data: data.map(d => d.spend),
        backgroundColor: data.map((d,i) =>
          activeYear !== 'all' ? '#0e9aa7' : CHART_COLORS[(i + 2) % CHART_COLORS.length] + 'cc'
        ),
        hoverBackgroundColor: data.map((d,i) =>
          activeYear !== 'all' ? '#0e9aa7' : CHART_COLORS[(i + 2) % CHART_COLORS.length]
        ),
        barPercentage: 0.7,
        categoryPercentage: 0.85,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        tooltip: {
          callbacks: { label: item => fmtDec(item.raw) + ` (${data[item.dataIndex].count} items)` }
        }
      },
      scales: {
        x: { beginAtZero: true, ticks: { callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v) } },
        y: { ticks: { font: { size: 11 } } }
      }
    }
  });
}

function buildSnsProductsTable() {
  const tbody = document.querySelector('#snsProductsTable tbody');
  if (!tbody) return;
  let products = DATA.subscribe_save.top_products;

  // If a year is selected, recompute from all_orders
  if (activeYear !== 'all') {
    const snsFiltered = DATA.all_orders.filter(o => o.date.startsWith(activeYear) && o.is_sns);
    const prodMap = {};
    const prodSpend = {};
    for (const o of snsFiltered) {
      prodMap[o.product] = (prodMap[o.product] || 0) + 1;
      prodSpend[o.product] = (prodSpend[o.product] || 0) + o.total;
    }
    products = Object.entries(prodMap)
      .map(([product, count]) => ({ product, count, spend: Math.round(prodSpend[product] * 100) / 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>${escapeHtml(p.product)}</td>
      <td class="num">${p.count}</td>
      <td class="num" style="font-weight:600">${fmtDec(p.spend)}</td>
      <td class="num">${fmtDec(p.spend / p.count)}</td>
    </tr>
  `).join('');
}

// ── Monthly Toggle ──
function setupMonthlyToggle() {
  document.getElementById('monthlyToggle').querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('monthlyToggle').querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      monthlyView = btn.dataset.view;
      if (charts.monthly) charts.monthly.destroy();
      buildMonthlyChart(getChartDefaults());
    });
  });
}

// ── S&S Monthly Toggle ──
function setupSnsMonthlyToggle() {
  const toggle = document.getElementById('snsMonthlyToggle');
  if (!toggle) return;
  toggle.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      toggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      snsMonthlyView = btn.dataset.view;
      if (charts.snsMonthly) charts.snsMonthly.destroy();
      buildSnsMonthlyChart(getChartDefaults());
    });
  });
}

// ── Table ──
function buildTable(items) {
  const tbody = document.querySelector('#topItemsTable tbody');
  tbody.innerHTML = items.map(item => `
    <tr>
      <td style="white-space:nowrap">${item.date}</td>
      <td>${escapeHtml(item.product)}</td>
      <td><span class="cat-badge">${escapeHtml(item.category)}</span></td>
      <td class="num" style="font-weight:600">${fmtDec(item.total)}</td>
    </tr>
  `).join('');
}

// ── Search ──
function setupSearch() {
  const input = document.getElementById('searchInput');
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const q = input.value.toLowerCase().trim();
      if (!q) {
        buildTable(DATA.top_items);
        return;
      }
      const results = DATA.all_orders
        .filter(o => o.product.toLowerCase().includes(q) || o.category.toLowerCase().includes(q))
        .slice(0, 100);
      buildTable(results);
    }, 200);
  });
}
