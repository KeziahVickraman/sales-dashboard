/**
 * charts.js
 * ─────────
 * All Chart.js rendering functions.
 * Each function takes the current DATA array and renders into a canvas by ID.
 * Call mkChart(id, config) to safely destroy-and-recreate any chart.
 */

const PALETTE = ['#378ADD', '#1D9E75', '#BA7517', '#534AB7', '#E24B4A', '#D85A30'];

/** Destroy existing chart if any, then create new one. */
function mkChart(id, cfg) {
  const el = document.getElementById(id);
  if (!el) return null;
  const existing = Chart.getChart(el);
  if (existing) existing.destroy();
  return new Chart(el, cfg);
}

/** Format a number as compact currency string */
function fmt(n) {
  if (!Number.isFinite(n)) return '$0';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return '$' + Math.round(n / 1_000) + 'k';
  return '$' + Math.round(n);
}

// ── Overview charts ──────────────────────────────────────────────────────────

function renderRoleRevenueChart(data, targetId) {
  const roles = {};
  data.forEach(e => { roles[e.role] = (roles[e.role] || 0) + e.annualRev; });
  const keys = Object.keys(roles);
  mkChart(targetId || 'c-role', {
    type: 'bar',
    data: {
      labels: keys,
      datasets: [{
        label: 'Revenue',
        data: keys.map(r => roles[r]),
        backgroundColor: keys.map((_, i) => PALETTE[i % PALETTE.length]),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { font: { size: 11 } } }, y: { ticks: { callback: v => fmt(v) } } },
    },
  });
}

function renderMonthlyChart(data, targetId) {
  const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Per-month revenue = Σ (days_worked × daily_rate) across employees
  const mRevs = months.map((_, i) => Math.round(
    data.reduce((s, e) => s + (e.monthly2026?.[i] || 0) * (e.daily || 0), 0)
  ));

  // Target line: 8% above the average month
  const avg = mRevs.reduce((a, b) => a + b, 0) / months.length;
  const target = Math.round(avg * 1.08) || 0;

  mkChart(targetId || 'c-monthly', {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        { label: 'Revenue', data: mRevs, borderColor: '#378ADD', backgroundColor: 'rgba(55,138,221,0.08)', fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2 },
        { label: 'Target', data: months.map(() => target), borderColor: '#1D9E75', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, fill: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } },
      },
      scales: { y: { ticks: { callback: v => fmt(v) } } },
    },
  });
}

function renderGMHistogram(data, targetId) {
  const buckets = ['<10%', '10–15%', '15–20%', '>20%'];
  const counts = [0, 0, 0, 0];
  data.forEach(e => {
    if (e.gm < 10) counts[0]++;
    else if (e.gm < 15) counts[1]++;
    else if (e.gm < 20) counts[2]++;
    else counts[3]++;
  });
  mkChart(targetId || 'c-gm', {
    type: 'bar',
    data: { labels: buckets, datasets: [{ data: counts, backgroundColor: ['#E24B4A', '#378ADD', '#1D9E75', '#27500A'], borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { stepSize: 1 } } } },
  });
}

function renderVisaChart(data, targetId) {
  const visas = {};
  data.forEach(e => { visas[e.visa] = (visas[e.visa] || 0) + 1; });
  mkChart(targetId || 'c-visa', {
    type: 'doughnut',
    data: { labels: Object.keys(visas), datasets: [{ data: Object.values(visas), backgroundColor: PALETTE }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10 } } } },
  });
}

function renderLocationChart(data, targetId) {
  const locs = {};
  data.forEach(e => { locs[e.loc] = (locs[e.loc] || 0) + e.annualRev; });
  mkChart(targetId || 'c-loc', {
    type: 'doughnut',
    data: { labels: Object.keys(locs), datasets: [{ data: Object.values(locs), backgroundColor: PALETTE }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10 } } } },
  });
}

// ── Forecast charts ──────────────────────────────────────────────────────────

function renderForecastChart(hist, proj, targetId) {
  mkChart(targetId || 'c-forecast', {
    type: 'line',
    data: {
      labels: ['2023', '2024', '2025', '2026', '2027', '2028'],
      datasets: [
        { label: 'Upper band', data: [null, null, null, ...proj.map((v, i) => v * (1 + 0.08 + i * 0.02))], borderWidth: 0, backgroundColor: 'rgba(27,157,117,0.10)', fill: '+1', pointRadius: 0 },
        { label: 'Lower band', data: [null, null, null, ...proj.map((v, i) => v * (1 - 0.06 - i * 0.015))], borderWidth: 0, fill: false, pointRadius: 0 },
        { label: 'Historic', data: [...hist, null, null, null], borderColor: '#378ADD', backgroundColor: 'rgba(55,138,221,0.08)', fill: true, tension: 0.3, pointRadius: 5, borderWidth: 2 },
        { label: 'Projected', data: [null, null, hist[2], ...proj], borderColor: '#1D9E75', borderDash: [6, 3], tension: 0.3, pointRadius: 5, borderWidth: 2, fill: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { ticks: { callback: v => fmt(v) } } },
    },
  });
}

function renderHeadcountForecastChart(hcH, hcP, targetId) {
  mkChart(targetId || 'c-hcfc', {
    type: 'bar',
    data: {
      labels: ['2023', '2024', '2025', '2026', '2027', '2028'],
      datasets: [
        { label: 'Actual',    data: [...hcH, null, null, null], backgroundColor: '#378ADD', borderRadius: 4 },
        { label: 'Projected', data: [null, null, null, ...hcP], backgroundColor: '#1D9E75', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10 } } },
      scales: { y: { ticks: { stepSize: 2 } } },
    },
  });
}

function renderRPRChart(rprH, rprP, targetId) {
  mkChart(targetId || 'c-rpr', {
    type: 'line',
    data: {
      labels: ['2023', '2024', '2025', '2026', '2027', '2028'],
      datasets: [{ label: 'Rev/resource', data: [...rprH, ...rprP], borderColor: '#BA7517', tension: 0.3, pointRadius: 5, fill: false, borderWidth: 2 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { ticks: { callback: v => fmt(v) } } },
    },
  });
}

// ── Attrition charts ─────────────────────────────────────────────────────────

/**
 * Accepts either:
 *   - a single number → falls back to the legacy synthetic [12, 14, X] pattern
 *   - an array of 3 numbers (percentages) → plots real 2023/2024/2025 rates
 */
function renderAttritionTrendChart(attrRateOrRates, targetId) {
  const rates = Array.isArray(attrRateOrRates)
    ? attrRateOrRates
    : [12, 14, attrRateOrRates];
  const retention = rates.map(r => 100 - r);
  mkChart(targetId || 'c-attr-trend', {
    type: 'line',
    data: {
      labels: ['2023', '2024', '2025'],
      datasets: [
        { label: 'Attrition %', data: rates,     borderColor: '#E24B4A', backgroundColor: 'rgba(226,75,74,0.08)', fill: true, tension: 0.3, pointRadius: 6, borderWidth: 2 },
        { label: 'Retention %', data: retention, borderColor: '#1D9E75', tension: 0.3, pointRadius: 6, fill: false, borderWidth: 2 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%` } } },
      scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } },
    },
  });
}

/**
 * If realByRole is provided (array of { role, attritionPct }), it plots those
 * verbatim; otherwise falls back to the tenure heuristic over `data`.
 */
function renderAttritionByRoleChart(data, realByRole, targetId) {
  let labels, values;
  if (realByRole && realByRole.length) {
    labels = realByRole.map(r => r.role);
    values = realByRole.map(r => Math.round((r.attritionPct || 0) * 100));
  } else {
    labels = [...new Set(data.map(e => e.role))];
    values = labels.map(r => {
      const emp = data.filter(e => e.role === r);
      return emp.length === 0 ? 0
        : Math.round(emp.filter(e => e.months < 8 || e.months > 42).length / emp.length * 100);
    });
  }
  mkChart(targetId || 'c-attr-role', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Attrition %',
        data: values,
        backgroundColor: values.map(v => v > 25 ? '#E24B4A' : v > 15 ? '#BA7517' : '#1D9E75'),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%` } } },
      scales: { x: { ticks: { font: { size: 11 } } }, y: { ticks: { callback: v => v + '%' } } },
    },
  });
}

function renderAttritionAnalysisChart(rows, targetId) {
  mkChart(targetId || 'c-aa-trend', {
    type: 'bar',
    data: {
      labels: rows.map(r => String(r.year)),
      datasets: [
        { type: 'line', label: 'Attrition %', data: rows.map(r => r.attritionPct), borderColor: '#E24B4A', backgroundColor: 'rgba(226,75,74,0.08)', yAxisID: 'pct', tension: 0.3, pointRadius: 5, borderWidth: 2 },
        { type: 'line', label: 'Retention %', data: rows.map(r => r.retentionPct), borderColor: '#1D9E75', yAxisID: 'pct', tension: 0.3, pointRadius: 5, borderWidth: 2 },
        { label: 'Revenue lost', data: rows.map(r => r.revenueLost), backgroundColor: '#BA7517', borderRadius: 4, yAxisID: 'money' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10 } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.yAxisID === 'money' ? `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` : `${ctx.dataset.label}: ${ctx.parsed.y}%` } },
      },
      scales: {
        pct: { position: 'left', min: 0, max: 100, ticks: { callback: v => v + '%' } },
        money: { position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: v => fmt(v) } },
      },
    },
  });
}

function renderFeatureImportanceChart(targetId) {
  mkChart(targetId || 'c-feat', {
    type: 'bar',
    data: {
      labels: ['Tenure pattern', 'Low GM%', 'New hire < 6mo', 'Role category', 'Visa status', 'Location'],
      datasets: [{ label: 'Importance', data: [0.35, 0.28, 0.18, 0.10, 0.05, 0.04], backgroundColor: '#378ADD', borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { max: 0.4, ticks: { callback: v => Math.round(v * 100) + '%' } } },
    },
  });
}

// ── Historical trend charts ──────────────────────────────────────────────────

function renderTrendRevenueChart(perYear, targetId) {
  mkChart(targetId || 'c-tr-rev', {
    type: 'bar',
    data: {
      labels: perYear.map(p => String(p.year)),
      datasets: [
        { label: 'Revenue', data: perYear.map(p => p.rev),    backgroundColor: '#378ADD', borderRadius: 4 },
        { label: 'Margin',  data: perYear.map(p => p.margin), backgroundColor: '#1D9E75', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } } },
      scales: { y: { ticks: { callback: v => fmt(v) } } },
    },
  });
}

function renderTrendHeadcountChart(perYear, targetId) {
  mkChart(targetId || 'c-tr-hc', {
    type: 'line',
    data: {
      labels: perYear.map(p => String(p.year)),
      datasets: [{
        label: 'Headcount',
        data: perYear.map(p => p.hc),
        borderColor: '#BA7517',
        backgroundColor: 'rgba(186,117,23,0.10)',
        fill: true, tension: 0.3, pointRadius: 6, borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } },
    },
  });
}

function renderTrendByClientChart(data, years, targetId) {
  const clients = [...new Set(data.map(e => e.client))].sort();
  mkChart(targetId || 'c-tr-client', {
    type: 'bar',
    data: {
      labels: clients,
      datasets: years.map((y, i) => ({
        label: String(y),
        data: clients.map(c =>
          data.filter(e => e.client === c).reduce((s, e) => s + (e.yearly[y]?.rev || 0), 0)
        ),
        backgroundColor: PALETTE[i % PALETTE.length],
        borderRadius: 4,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10 } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } },
      },
      scales: { x: { ticks: { font: { size: 11 } } }, y: { ticks: { callback: v => fmt(v) } } },
    },
  });
}

function renderTrendByRoleChart(data, years, targetId) {
  const roles = [...new Set(data.map(e => e.role))].sort();
  mkChart(targetId || 'c-tr-role', {
    type: 'bar',
    data: {
      labels: roles,
      datasets: years.map((y, i) => ({
        label: String(y),
        data: roles.map(r =>
          data.filter(e => e.role === r).reduce((s, e) => s + (e.yearly[y]?.rev || 0), 0)
        ),
        backgroundColor: PALETTE[i % PALETTE.length],
        borderRadius: 4,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10 } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } },
      },
      scales: { x: { ticks: { font: { size: 11 } } }, y: { ticks: { callback: v => fmt(v) } } },
    },
  });
}

// ── Portfolio bubble chart ───────────────────────────────────────────────────

function renderBubbleChart(data, targetId) {
  const clients = [...new Set(data.map(e => e.client))];
  const colorMap = {};
  clients.forEach((c, i) => { colorMap[c] = PALETTE[i % PALETTE.length]; });
  const gmValues = data.map(e => e.gm).filter(Number.isFinite);
  const xMin = gmValues.length ? Math.max(0, Math.min(...gmValues) - 2) : 0;
  const xMax = gmValues.length ? Math.max(...gmValues) + 2 : 25;

  mkChart(targetId || 'c-bubble', {
    type: 'bubble',
    data: {
      datasets: clients.map(client => {
        const emps = data.filter(e => e.client === client);
        return {
          label: client,
          data: emps.map(e => ({
            x: parseFloat(e.gm.toFixed(1)),
            y: Math.round(e.annualRev / 1000),
            r: Math.max(5, Math.sqrt(e.months) * 2 + 4),
            name: e.name,
          })),
          backgroundColor: colorMap[client] + '99',
          borderColor: colorMap[client],
          borderWidth: 1,
        };
      }),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10 } },
        tooltip: { callbacks: { label: ctx => `${ctx.raw.name}: GM ${ctx.raw.x}% | Rev ${fmt(ctx.raw.y * 1000)}` } },
      },
      scales: {
        x: { title: { display: true, text: 'GM%', font: { size: 11 } }, min: xMin, max: xMax },
        y: { title: { display: true, text: 'Annual rev ($k)', font: { size: 11 } }, ticks: { callback: v => '$' + v + 'k' } },
      },
    },
  });
}
