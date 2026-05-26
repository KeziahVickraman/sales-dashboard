/**
 * dashboard.js
 * ────────────
 * Main application logic: state, panel switching, file upload,
 * all panel render functions, and AI Insights API calls.
 *
 * Depends on: data.js, charts.js, config.js
 */

// ── App state ────────────────────────────────────────────────────────────────
let DATA = [...DEMO_DATA];
let ATTRITION_DATA = null; // populated from attrition_analysis sheet when present
let isLiveData = false;
let currentScenario = 'base';

// Scenarios are mutable so users can edit YoY revenue growth rates from
// the Forecast panel. Headcount growth (hcGrowth) stays fixed for now.
let SCENARIOS = {
  base: { growth: [0.18, 0.15, 0.12], hcGrowth: [0.20, 0.12, 0.10] },
  bull: { growth: [0.25, 0.22, 0.18], hcGrowth: [0.28, 0.20, 0.15] },
  bear: { growth: [0.08, 0.06, 0.05], hcGrowth: [0.05, 0.04, 0.03] },
};

// Deltas (in percentage points) used by "Suggest from base"
const SUGGEST_DELTAS = {
  bull: [ +7, +7, +6],
  bear: [-10, -9, -7],
};

let _rateInputsSynced = false;

// ── Utility ──────────────────────────────────────────────────────────────────

/** Format number as compact currency */
function fmt(n) {
  if (!Number.isFinite(n)) return '$0';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return '$' + Math.round(n / 1_000) + 'k';
  return '$' + Math.round(n);
}

function el(id) { return document.getElementById(id); }

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

// ── Navigation ───────────────────────────────────────────────────────────────
function showPanel(id, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el('panel-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  // Lazy-render on tab open
  if (id === 'forecast')  renderForecast();
  if (id === 'attrition-analysis') renderAttritionAnalysis();
  if (id === 'attrition') renderAttrition();
  if (id === 'portfolio') renderPortfolio();
  if (id === 'trend')     renderTrend();
}

// ── File upload ──────────────────────────────────────────────────────────────
function showStatus(msg, type) {
  const statusEl = el('status-msg');
  statusEl.style.display = 'flex';
  statusEl.className = 'status-bar status-' + type;
  const icon = type === 'loading' ? '<span class="spinner"></span>'
             : type === 'success' ? '<i class="ti ti-check"></i>'
             : '<i class="ti ti-x"></i>';
  statusEl.innerHTML = `${icon}<span>${escapeHTML(msg)}</span>`;
}

function handleFile(file) {
  if (!file) return;
  el('upload-panel').style.display = 'block';
  showStatus('Reading ' + file.name + '…', 'loading');

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const parsed = parseWorkbook(wb);
      if (parsed.length === 0) {
        showStatus('No employee rows found in full_data sheet. Check column headers match the template.', 'error');
        return;
      }
      DATA = parsed;
      ATTRITION_DATA = parseAttritionAnalysis(wb);
      isLiveData = true;
      el('data-badge').className = 'data-source-badge ds-live';
      el('data-badge').innerHTML = '<i class="ti ti-database"></i> Live data';
      const attrNote = ATTRITION_DATA ? ' · attrition_analysis sheet detected' : '';
      showStatus(`Loaded ${parsed.length} employees from ${file.name}${attrNote}`, 'success');
      refreshAll();
    } catch (err) {
      showStatus('Parse error: ' + err.message, 'error');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function refreshAll() {
  initOverview();
  renderForecast();
  resetFilters();
  renderAttritionAnalysis();
  renderAttrition();
  renderPortfolio();
  renderTrend();
}

// ── Overview ─────────────────────────────────────────────────────────────────
function initOverview() {
  const totalRev    = DATA.reduce((s, e) => s + e.annualRev, 0);
  const totalMargin = DATA.reduce((s, e) => s + e.annualMargin, 0);
  const avgGM       = totalRev > 0 ? (totalMargin / totalRev * 100) : 0;
  const hc          = DATA.length;
  const rpr         = hc > 0 ? totalRev / hc : 0;
  const attrRate    = hc > 0 ? Math.round(DATA.filter(e => e.months < 8 || e.months > 42).length / hc * 100) : 0;

  el('kpi-hc').textContent    = hc;
  el('kpi-hc-d').textContent  = isLiveData ? 'from your data' : 'demo data';
  el('kpi-rev').textContent   = fmt(totalRev);
  el('kpi-rev-d').textContent = 'annual';
  el('kpi-gm').textContent    = avgGM.toFixed(1) + '%';
  el('kpi-gm-d').textContent  = avgGM > 15 ? 'above 15% target' : 'below 15% target';
  el('kpi-gm-d').className    = 'kpi-delta ' + (avgGM > 15 ? 'delta-up' : 'delta-dn');
  el('kpi-rpr').textContent   = fmt(rpr);
  el('kpi-attr').textContent  = attrRate + '%';
  el('kpi-attr-d').textContent = attrRate > 20 ? 'high risk' : 'manageable';

  renderRoleRevenueChart(DATA);
  renderMonthlyChart(DATA);
  renderGMHistogram(DATA);
  renderVisaChart(DATA);
  renderLocationChart(DATA);
}

// ── Forecast ─────────────────────────────────────────────────────────────────
function setScenario(s, btn) {
  currentScenario = s;
  document.querySelectorAll('.sc-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderForecast();
}

/** Format a multiplier (0.18) as a percentage string for an input ("18" or "18.5") */
function fmtRatePct(r) {
  const v = +(r * 100).toFixed(1);
  return Number.isInteger(v) ? String(v) : String(v);
}

/** Push current SCENARIOS values into the editable rate inputs */
function syncRateInputsFromScenarios() {
  ['base', 'bull', 'bear'].forEach(sc => {
    for (let i = 0; i < 3; i++) {
      const inp = el(`r-${sc}-${i}`);
      if (inp) inp.value = fmtRatePct(SCENARIOS[sc].growth[i]);
    }
  });
}

/** Called from rate input onchange — updates SCENARIOS and re-renders */
function updateRate(scenario, idx, inputEl) {
  const pct = parseFloat(inputEl.value);
  if (!isFinite(pct)) return;
  SCENARIOS[scenario].growth[idx] = pct / 100;
  renderForecast();
}

/** Fill bull or bear from base ± fixed deltas (per-year, clamped at 0) */
function suggestFromBase(scenario) {
  const deltas = SUGGEST_DELTAS[scenario];
  if (!deltas) return;
  const baseGrowth = SCENARIOS.base.growth;
  SCENARIOS[scenario].growth = baseGrowth.map((g, i) =>
    Math.max(0, g * 100 + deltas[i]) / 100
  );
  syncRateInputsFromScenarios();
  renderForecast();
}

function renderForecast() {
  if (!_rateInputsSynced) {
    syncRateInputsFromScenarios();
    _rateInputsSynced = true;
  }
  const sc          = SCENARIOS[currentScenario];
  const base2025Rev = DATA.reduce((s, e) => s + e.annualRev, 0);
  const base2025HC  = DATA.length;

  const hist = [base2025Rev * 0.68, base2025Rev * 0.82, base2025Rev];
  const proj = [hist[2] * (1 + sc.growth[0]), 0, 0];
  proj[1] = proj[0] * (1 + sc.growth[1]);
  proj[2] = proj[1] * (1 + sc.growth[2]);
  const cagr = hist[2] > 0 ? (Math.pow(proj[2] / hist[2], 1 / 3) - 1) * 100 : 0;

  el('fc-26r').textContent = fmt(proj[0]);
  el('fc-27r').textContent = fmt(proj[1]);
  el('fc-28r').textContent = fmt(proj[2]);
  el('fc-cagr').textContent = cagr.toFixed(1) + '%';

  const hcH = [Math.round(base2025HC * 0.72), Math.round(base2025HC * 0.85), base2025HC];
  const hcP = [Math.round(base2025HC * (1 + sc.hcGrowth[0])), 0, 0];
  hcP[1] = Math.round(hcP[0] * (1 + sc.hcGrowth[1]));
  hcP[2] = Math.round(hcP[1] * (1 + sc.hcGrowth[2]));

  const safeDiv = (a, b) => b > 0 ? a / b : 0;
  const rprH = hist.map((r, i) => safeDiv(r, hcH[i]));
  const rprP = proj.map((r, i) => safeDiv(r, hcP[i]));

  renderForecastChart(hist, proj);
  renderHeadcountForecastChart(hcH, hcP);
  renderRPRChart(rprH, rprP);

  // Projection table
  const rows = [
    ['Headcount',          ...[base2025HC, ...hcP].map(Math.round)],
    ['Annual revenue',     ...[hist[2], ...proj].map(fmt)],
    ['Annual margin',      ...[hist[2] * 0.137, ...proj.map(v => v * 0.14)].map(fmt)],
    ['GM %',               '13.7%', '14.0%', '14.0%', '14.0%'],
    ['Revenue / resource', ...[safeDiv(hist[2], base2025HC), ...rprP].map(fmt)],
  ];
  el('proj-tbody').innerHTML = rows
    .map((r, i) => `<tr class="${i === 1 || i === 2 ? 'bold' : ''}">${r.map(c => `<td>${escapeHTML(c)}</td>`).join('')}</tr>`)
    .join('');
}

// ── Attrition ────────────────────────────────────────────────────────────────
function renderAttrition() {
  const hc        = DATA.length;
  const totalRev  = DATA.reduce((s, e) => s + e.annualRev, 0);
  const avgSalary = hc > 0 ? DATA.reduce((s, e) => s + e.salary, 0) / hc : 0;

  const real = ATTRITION_DATA;
  const haveRealTrend = !!(real && real.trend && real.trend[2025]);

  // KPIs: prefer real 2025 figures; otherwise fall back to tenure heuristic
  let attrRate, retRate, revAtRisk, replaceCost;
  if (haveRealTrend) {
    const t2025 = real.trend[2025];
    attrRate    = Math.round(t2025.attritionRate * 100);
    retRate     = Math.round(t2025.retentionRate * 100);
    // Revenue at risk: prefer real revenue-lost figure, else apply rate to portfolio
    revAtRisk   = real.revenueImpact?.[2025]?.revenueLost > 0
                    ? real.revenueImpact[2025].revenueLost
                    : totalRev * (attrRate / 100);
    // Replacement cost: 0.5× avg salary × actual people who left
    replaceCost = avgSalary * 0.5 * (t2025.left || (hc * attrRate / 100));
  } else {
    attrRate    = hc > 0 ? Math.round(DATA.filter(e => e.months < 8 || e.months > 42).length / hc * 100) : 0;
    retRate     = 100 - attrRate;
    revAtRisk   = totalRev * (attrRate / 100);
    replaceCost = avgSalary * 0.5 * (hc * attrRate / 100);
  }

  el('a-rate').textContent = attrRate + '%';
  el('a-ret').textContent  = retRate  + '%';
  el('a-rev').textContent  = fmt(revAtRisk);
  el('a-cost').textContent = fmt(replaceCost);

  // Transparency note — explicit about where these numbers come from
  const note = el('a-source-note');
  if (note) {
    note.textContent = haveRealTrend
      ? 'Source: attrition_analysis sheet (2025 actuals). Per-year rates, by-role breakdown and revenue lost read directly from the workbook.'
      : 'Source: tenure heuristic (employees with <8 or >42 months counted as at-risk). Populate the attrition_analysis sheet for real 2023–2025 rates.';
  }

  // Trend chart: real per-year rates if available
  if (haveRealTrend) {
    const rates = TREND_YEARS.map(y => Math.round((real.trend[y].attritionRate || 0) * 100));
    renderAttritionTrendChart(rates);
  } else {
    renderAttritionTrendChart(attrRate);
  }

  // By-role chart: real percentages if available
  if (real && real.byRole && real.byRole.length) {
    renderAttritionByRoleChart(DATA, real.byRole);
  } else {
    renderAttritionByRoleChart(DATA);
  }

  // Risk table
  const withRisk = DATA.map(e => {
    const tS = e.months < 6 ? 30 : e.months < 12 ? 20 : e.months > 42 ? 18 : 8;
    const gmS = e.gm < 12 ? 18 : e.gm > 18 ? 5 : 10;
    return { ...e, riskScore: Math.min(95, 38 + tS + gmS) };
  }).sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);

  el('risk-tbody').innerHTML = withRisk.map(e => {
    const hClass = e.riskScore >= 70 ? 'badge-red' : e.riskScore >= 50 ? 'badge-amber' : 'badge-green';
    const hLabel = e.riskScore >= 70 ? 'High' : e.riskScore >= 50 ? 'Medium' : 'Low';
    const sig    = e.months < 8 ? 'New hire' : e.months > 42 ? 'Tenure plateau' : e.gm < 12 ? 'Low margin' : 'Stable';
    return `<tr>
      <td>${escapeHTML(e.name)}</td>
      <td>${escapeHTML(e.role)}</td>
      <td>${escapeHTML(e.months)}mo</td>
      <td>${fmt(e.annualRev)}</td>
      <td>${e.gm.toFixed(1)}%</td>
      <td><strong>${e.riskScore}</strong></td>
      <td><span class="badge ${hClass}">${hLabel}</span> <span style="font-size:11px;color:var(--color-text-secondary)">${escapeHTML(sig)}</span></td>
    </tr>`;
  }).join('');

  renderFeatureImportanceChart();
}

function renderAttritionAnalysis() {
  const analysisBody = el('attrition-analysis-tbody');
  if (analysisBody) {
    const yearF = el('aa-year')?.value || '';
    const cF    = el('aa-client')?.value || '';
    const rF    = el('aa-role')?.value || '';
    const lF    = el('aa-loc')?.value || '';
    const filtered = DATA.filter(e =>
      (cF === '' || e.client === cF) &&
      (rF === '' || e.role === rF) &&
      (lF === '' || e.loc === lF)
    );
    const hasSegmentFilter = cF !== '' || rF !== '' || lF !== '';
    const real = ATTRITION_DATA;
    const haveRealTrend = !!(real && real.trend && real.trend[2025]);
    const currentAttrRate = filtered.length > 0 ? Math.round(filtered.filter(e => e.months < 8 || e.months > 42).length / filtered.length * 100) : 0;
    const fallbackRates = [12, 14, currentAttrRate];
    const rows = TREND_YEARS.map((year, i) => {
      const active = filtered.filter(e => e.yearly && e.yearly[year] && e.yearly[year].rev > 0);
      const prevActive = i > 0 ? filtered.filter(e => e.yearly && e.yearly[TREND_YEARS[i - 1]] && e.yearly[TREND_YEARS[i - 1]].rev > 0) : [];
      const activeRev = active.reduce((s, e) => s + (e.yearly[year]?.rev || 0), 0);
      const proxyRate = active.length > 0 ? active.filter(e => e.months < 8 || e.months > 42).length / active.length : fallbackRates[i] / 100;
      const trend = haveRealTrend && !hasSegmentFilter ? real.trend[year] : null;
      const impact = real?.revenueImpact?.[year];
      const rate = trend ? trend.attritionRate : fallbackRates[i] / 100;
      const filteredRate = trend ? rate : proxyRate;
      const retention = trend ? trend.retentionRate : 1 - filteredRate;
      const openingHC = trend ? trend.openingHC : active.length;
      const newHires = trend ? trend.newHires : Math.max(0, active.length - prevActive.length);
      const left = trend ? trend.left : Math.round(active.length * filteredRate);
      const revenueLost = trend && impact?.revenueLost ? impact.revenueLost : activeRev * filteredRate;
      return {
        year, openingHC, newHires, left, revenueLost,
        attritionPct: Math.round(filteredRate * 100),
        retentionPct: Math.round(retention * 100),
      };
    });
    // Determine rows to display: explicitly check for valid year values
    const validYears = TREND_YEARS.map(String); // ['2023','2024','2025']
    let tableRows = (yearF && validYears.includes(yearF))
      ? rows.filter(r => String(r.year) === yearF)
      : rows; // 'All years' (empty value) or unrecognised → show all
    // Safety fallback: never leave the table empty when data exists
    if (tableRows.length === 0 && rows.length > 0) tableRows = rows;
    // Populate table first — always succeeds regardless of chart state
    analysisBody.innerHTML = tableRows.map(row =>
      `<tr>
        <td><strong>${row.year}</strong></td>
        <td>${escapeHTML(row.openingHC)}</td>
        <td>${escapeHTML(row.newHires)}</td>
        <td>${escapeHTML(row.left)}</td>
        <td>${row.attritionPct}%</td>
        <td>${row.retentionPct}%</td>
        <td>${fmt(row.revenueLost)}</td>
      </tr>`
    ).join('');
    // Render chart after table — wrapped so any chart error doesn't block the table
    try { renderAttritionAnalysisChart(tableRows); } catch(chartErr) { console.warn('Attrition chart error:', chartErr); }
  }
}

// ── Portfolio ────────────────────────────────────────────────────────────────
function populateFilter(selectId, field) {
  const sel = el(selectId);
  if (!sel) return;
  const placeholder = sel.options[0]?.textContent || 'All';
  const current = sel.value;
  sel.innerHTML = '';
  const all = document.createElement('option');
  all.value = '';
  all.textContent = placeholder;
  sel.appendChild(all);
  [...new Set(DATA.map(e => e[field]))].sort().forEach(v => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  });
  sel.value = Array.from(sel.options).some(o => o.value === current) ? current : '';
}

function resetFilters() {
  populateFilter('filter-client', 'client');
  populateFilter('filter-role',   'role');
  populateFilter('tr-client',     'client');
  populateFilter('tr-role',       'role');
  populateFilter('tr-loc',        'loc');
  populateFilter('aa-client',     'client');
  populateFilter('aa-role',       'role');
  populateFilter('aa-loc',        'loc');
}

function renderPortfolio() {
  const cSel   = el('filter-client').value;
  const rSel   = el('filter-role').value;
  const sortBy = el('sort-by').value;

  let data = DATA.filter(e => (cSel === '' || e.client === cSel) && (rSel === '' || e.role === rSel));
  if (sortBy === 'rev')    data.sort((a, b) => b.annualRev - a.annualRev);
  if (sortBy === 'gm')     data.sort((a, b) => b.gm - a.gm);
  if (sortBy === 'tenure') data.sort((a, b) => b.months - a.months);

  const totRev = data.reduce((s, e) => s + e.annualRev, 0);
  const totMgn = data.reduce((s, e) => s + e.annualMargin, 0);
  el('pf-count').textContent  = data.length + ' placements';
  el('pf-rev').textContent    = fmt(totRev);
  el('pf-margin').textContent = fmt(totMgn);
  el('pf-gm').textContent     = (totRev > 0 ? totMgn / totRev * 100 : 0).toFixed(1) + '%';

  renderBubbleChart(data);

  el('pf-tbody').innerHTML = data.map(e => {
    const h = e.gm >= 18 ? 'badge-green' : e.gm >= 13 ? 'badge-blue' : 'badge-amber';
    const l = e.gm >= 18 ? 'High margin' : e.gm >= 13 ? 'Healthy' : 'Watch';
    return `<tr>
      <td>${escapeHTML(e.name)}</td>
      <td>${escapeHTML(e.client)}</td>
      <td>${escapeHTML(e.role)}</td>
      <td>${escapeHTML(e.loc)}</td>
      <td>${escapeHTML(e.months)}mo</td>
      <td>${fmt(e.annualRev)}</td>
      <td>${e.gm.toFixed(1)}%</td>
      <td><span class="badge ${h}">${l}</span></td>
    </tr>`;
  }).join('');
}

// ── Historical Trend ─────────────────────────────────────────────────────────
function renderTrend() {
  const yearF = el('tr-year').value;
  const cF    = el('tr-client').value;
  const rF    = el('tr-role').value;
  const lF    = el('tr-loc').value;

  const filtered = DATA.filter(e =>
    (cF === '' || e.client === cF) &&
    (rF === '' || e.role   === rF) &&
    (lF === '' || e.loc    === lF)
  );

  // Aggregate per year across the filtered set
  const perYear = TREND_YEARS.map(y => {
    const active = filtered.filter(e => e.yearly[y] && e.yearly[y].rev > 0);
    const rev    = filtered.reduce((s, e) => s + (e.yearly[y]?.rev    || 0), 0);
    const margin = filtered.reduce((s, e) => s + (e.yearly[y]?.margin || 0), 0);
    const gm     = rev > 0 ? (margin / rev * 100) : 0;
    return { year: y, hc: active.length, rev, margin, gm };
  });

  // KPIs reflect the focus year (defaults to the latest year)
  const focusYear = parseInt(yearF) || TREND_REF_YEAR;
  const focusIdx  = TREND_YEARS.indexOf(focusYear);
  const focus     = perYear[focusIdx];
  const prev      = focusIdx > 0 ? perYear[focusIdx - 1] : null;

  el('tr-hc').textContent       = focus.hc;
  el('tr-hc-d').textContent     = 'in ' + focus.year;
  el('tr-rev').textContent      = fmt(focus.rev);
  el('tr-rev-d').textContent    = 'in ' + focus.year;
  el('tr-margin').textContent   = fmt(focus.margin);
  el('tr-margin-d').textContent = 'in ' + focus.year;
  el('tr-gm').textContent       = focus.gm.toFixed(1) + '%';

  if (prev && prev.rev > 0) {
    const yoy = (focus.rev - prev.rev) / prev.rev * 100;
    el('tr-yoy').textContent   = (yoy > 0 ? '+' : '') + yoy.toFixed(1) + '%';
    el('tr-yoy-d').textContent = 'vs ' + prev.year;
    el('tr-yoy-d').className   = 'kpi-delta ' + (yoy >= 0 ? 'delta-up' : 'delta-dn');
  } else {
    el('tr-yoy').textContent   = '—';
    el('tr-yoy-d').textContent = 'no prior year';
    el('tr-yoy-d').className   = 'kpi-delta';
  }

  renderTrendRevenueChart(perYear);
  renderTrendHeadcountChart(perYear);
  renderTrendByClientChart(filtered, TREND_YEARS);
  renderTrendByRoleChart(filtered, TREND_YEARS);

  // Breakdown table — if a year is selected show only that row, else all
  const tableRows = yearF ? perYear.filter(p => p.year === focusYear) : perYear;
  el('tr-tbody').innerHTML = tableRows.map(p => {
    const idx = TREND_YEARS.indexOf(p.year);
    const prevP = idx > 0 ? perYear[idx - 1] : null;
    const yoy   = prevP && prevP.rev > 0 ? (p.rev - prevP.rev) / prevP.rev * 100 : null;
    const yoyStr = yoy === null ? '—' : (yoy > 0 ? '+' : '') + yoy.toFixed(1) + '%';
    return `<tr>
      <td><strong>${p.year}</strong></td>
      <td>${p.hc}</td>
      <td>${fmt(p.rev)}</td>
      <td>${fmt(p.margin)}</td>
      <td>${p.gm.toFixed(1)}%</td>
      <td>${yoyStr}</td>
    </tr>`;
  }).join('');
}

// ── Chart fullscreen modal ───────────────────────────────────────────────────

function getForecastSeries() {
  const sc = SCENARIOS[currentScenario];
  const base2025Rev = DATA.reduce((s, e) => s + e.annualRev, 0);
  const base2025HC = DATA.length;
  const hist = [base2025Rev * 0.68, base2025Rev * 0.82, base2025Rev];
  const proj = [hist[2] * (1 + sc.growth[0]), 0, 0];
  proj[1] = proj[0] * (1 + sc.growth[1]);
  proj[2] = proj[1] * (1 + sc.growth[2]);
  const hcH = [Math.round(base2025HC * 0.72), Math.round(base2025HC * 0.85), base2025HC];
  const hcP = [Math.round(base2025HC * (1 + sc.hcGrowth[0])), 0, 0];
  hcP[1] = Math.round(hcP[0] * (1 + sc.hcGrowth[1]));
  hcP[2] = Math.round(hcP[1] * (1 + sc.hcGrowth[2]));
  const safeDiv = (a, b) => b > 0 ? a / b : 0;
  return {
    hist,
    proj,
    hcH,
    hcP,
    rprH: hist.map((r, i) => safeDiv(r, hcH[i])),
    rprP: proj.map((r, i) => safeDiv(r, hcP[i])),
  };
}

function getAttritionTrendInput() {
  const real = ATTRITION_DATA;
  if (real && real.trend && real.trend[2025]) {
    return TREND_YEARS.map(y => Math.round((real.trend[y].attritionRate || 0) * 100));
  }
  const hc = DATA.length;
  return hc > 0 ? Math.round(DATA.filter(e => e.months < 8 || e.months > 42).length / hc * 100) : 0;
}

function getAttritionAnalysisRows() {
  const yearF = el('aa-year')?.value || '';
  const cF = el('aa-client')?.value || '';
  const rF = el('aa-role')?.value || '';
  const lF = el('aa-loc')?.value || '';
  const filtered = DATA.filter(e =>
    (cF === '' || e.client === cF) &&
    (rF === '' || e.role === rF) &&
    (lF === '' || e.loc === lF)
  );
  const hasSegmentFilter = cF !== '' || rF !== '' || lF !== '';
  const real = ATTRITION_DATA;
  const haveRealTrend = !!(real && real.trend && real.trend[2025]);
  const currentAttrRate = filtered.length > 0 ? Math.round(filtered.filter(e => e.months < 8 || e.months > 42).length / filtered.length * 100) : 0;
  const fallbackRates = [12, 14, currentAttrRate];
  const rows = TREND_YEARS.map((year, i) => {
    const active = filtered.filter(e => e.yearly && e.yearly[year] && e.yearly[year].rev > 0);
    const prevActive = i > 0 ? filtered.filter(e => e.yearly && e.yearly[TREND_YEARS[i - 1]] && e.yearly[TREND_YEARS[i - 1]].rev > 0) : [];
    const activeRev = active.reduce((s, e) => s + (e.yearly[year]?.rev || 0), 0);
    const proxyRate = active.length > 0 ? active.filter(e => e.months < 8 || e.months > 42).length / active.length : fallbackRates[i] / 100;
    const trend = haveRealTrend && !hasSegmentFilter ? real.trend[year] : null;
    const impact = real?.revenueImpact?.[year];
    const rate = trend ? trend.attritionRate : fallbackRates[i] / 100;
    const filteredRate = trend ? rate : proxyRate;
    const retention = trend ? trend.retentionRate : 1 - filteredRate;
    return {
      year,
      openingHC: trend ? trend.openingHC : active.length,
      newHires: trend ? trend.newHires : Math.max(0, active.length - prevActive.length),
      left: trend ? trend.left : Math.round(active.length * filteredRate),
      revenueLost: trend && impact?.revenueLost ? impact.revenueLost : activeRev * filteredRate,
      attritionPct: Math.round(filteredRate * 100),
      retentionPct: Math.round(retention * 100),
    };
  });
  const validYears = TREND_YEARS.map(String);
  const tableRows = (yearF && validYears.includes(yearF)) ? rows.filter(r => String(r.year) === yearF) : rows;
  return tableRows.length === 0 && rows.length > 0 ? rows : tableRows;
}

function getPortfolioFilteredData() {
  const cSel = el('filter-client')?.value || '';
  const rSel = el('filter-role')?.value || '';
  const sortBy = el('sort-by')?.value || 'rev';
  const data = DATA.filter(e => (cSel === '' || e.client === cSel) && (rSel === '' || e.role === rSel));
  if (sortBy === 'rev') data.sort((a, b) => b.annualRev - a.annualRev);
  if (sortBy === 'gm') data.sort((a, b) => b.gm - a.gm);
  if (sortBy === 'tenure') data.sort((a, b) => b.months - a.months);
  return data;
}

function getTrendInputs() {
  const cF = el('tr-client')?.value || '';
  const rF = el('tr-role')?.value || '';
  const lF = el('tr-loc')?.value || '';
  const filtered = DATA.filter(e =>
    (cF === '' || e.client === cF) &&
    (rF === '' || e.role === rF) &&
    (lF === '' || e.loc === lF)
  );
  const perYear = TREND_YEARS.map(y => {
    const active = filtered.filter(e => e.yearly && e.yearly[y] && e.yearly[y].rev > 0);
    const rev = filtered.reduce((s, e) => s + (e.yearly?.[y]?.rev || 0), 0);
    const margin = filtered.reduce((s, e) => s + (e.yearly?.[y]?.margin || 0), 0);
    const gm = rev > 0 ? (margin / rev * 100) : 0;
    return { year: y, hc: active.length, rev, margin, gm };
  });
  return { filtered, perYear };
}

/** Maps each chart canvas ID to a function that renders it into the fullscreen target */
const FS_CHART_MAP = {
  'c-role':    () => renderRoleRevenueChart(DATA, 'c-fs-canvas'),
  'c-monthly': () => renderMonthlyChart(DATA,     'c-fs-canvas'),
  'c-gm':      () => renderGMHistogram(DATA,      'c-fs-canvas'),
  'c-visa':    () => renderVisaChart(DATA,         'c-fs-canvas'),
  'c-loc':     () => renderLocationChart(DATA,     'c-fs-canvas'),
  'c-forecast': () => {
    const s = getForecastSeries();
    renderForecastChart(s.hist, s.proj, 'c-fs-canvas');
  },
  'c-hcfc': () => {
    const s = getForecastSeries();
    renderHeadcountForecastChart(s.hcH, s.hcP, 'c-fs-canvas');
  },
  'c-rpr': () => {
    const s = getForecastSeries();
    renderRPRChart(s.rprH, s.rprP, 'c-fs-canvas');
  },
  'c-aa-trend': () => renderAttritionAnalysisChart(getAttritionAnalysisRows(), 'c-fs-canvas'),
  'c-attr-trend': () => renderAttritionTrendChart(getAttritionTrendInput(), 'c-fs-canvas'),
  'c-attr-role': () => renderAttritionByRoleChart(DATA, ATTRITION_DATA?.byRole, 'c-fs-canvas'),
  'c-feat': () => renderFeatureImportanceChart('c-fs-canvas'),
  'c-bubble': () => renderBubbleChart(getPortfolioFilteredData(), 'c-fs-canvas'),
  'c-tr-rev': () => renderTrendRevenueChart(getTrendInputs().perYear, 'c-fs-canvas'),
  'c-tr-hc': () => renderTrendHeadcountChart(getTrendInputs().perYear, 'c-fs-canvas'),
  'c-tr-client': () => {
    const t = getTrendInputs();
    renderTrendByClientChart(t.filtered, TREND_YEARS, 'c-fs-canvas');
  },
  'c-tr-role': () => {
    const t = getTrendInputs();
    renderTrendByRoleChart(t.filtered, TREND_YEARS, 'c-fs-canvas');
  },
};

function openChartFullscreen(canvasId, title) {
  const renderer = FS_CHART_MAP[canvasId];
  if (!renderer) return;
  el('chart-modal-title').textContent = title;
  el('chart-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  // requestAnimationFrame ensures the modal is visible before Chart.js measures its canvas
  requestAnimationFrame(() => renderer());
}

function closeChartFullscreen() {
  const fsCanvas = el('c-fs-canvas');
  if (fsCanvas) {
    const fsChart = Chart.getChart(fsCanvas);
    if (fsChart) fsChart.destroy();
  }
  el('chart-modal').style.display = 'none';
  document.body.style.overflow = '';
}

// ── AI Insights ──────────────────────────────────────────────────────────────

/** Build a compact plain-text summary of the current data for the AI prompt */
function buildDataSummary() {
  const totalRev    = DATA.reduce((s, e) => s + e.annualRev, 0);
  const totalMargin = DATA.reduce((s, e) => s + e.annualMargin, 0);
  const hc          = DATA.length;
  const attrRate    = hc > 0 ? Math.round(DATA.filter(e => e.months < 8 || e.months > 42).length / hc * 100) : 0;
  const avgGM       = totalRev > 0 ? (totalMargin / totalRev * 100).toFixed(1) : '0.0';
  const topClient   = Object.entries(DATA.reduce((m, e) => { m[e.client] = (m[e.client] || 0) + e.annualRev; return m; }, {}))
                        .sort((a, b) => b[1] - a[1])[0];
  const avgSalary   = hc > 0 ? DATA.reduce((s, e) => s + e.salary, 0) / hc : 0;
  const highRisk    = DATA.filter(e => e.months < 8 || e.gm < 12);
  const roles       = [...new Set(DATA.map(e => e.role))];
  const locs        = [...new Set(DATA.map(e => e.loc))];

  return `Staffing portfolio data:
- Headcount: ${hc}
- Total annual revenue: ${fmt(totalRev)}
- Total annual margin: ${fmt(totalMargin)}
- Average GM%: ${avgGM}%
- Estimated attrition rate: ${attrRate}%
- Revenue at risk: ${fmt(totalRev * attrRate / 100)}
- Top client: ${topClient ? topClient[0] + ' (' + fmt(topClient[1]) + ')' : 'N/A'}
- High-risk employees (new hire or low GM): ${highRisk.length}
- Avg replacement cost estimate (0.5× salary): ${fmt(avgSalary * 0.5)}
- Roles present: ${roles.join(', ')}
- Locations: ${locs.join(', ')}
- Employees with GM% > 18%: ${DATA.filter(e => e.gm > 18).length}
- Employees with GM% < 12%: ${DATA.filter(e => e.gm < 12).length}
- Data source: ${isLiveData ? 'live uploaded data' : 'demo data'}`;
}

const AI_PROMPTS = {
  summary:   'You are a staffing business analyst. Given this portfolio data, write a concise 3-paragraph executive summary covering: (1) overall financial health and revenue quality, (2) headcount and attrition risk, (3) top 2 opportunities. Be specific with the numbers provided.',
  attrition: 'You are a workforce analytics expert. Analyse the attrition risk in this staffing portfolio. Quantify the financial exposure, identify the highest-risk segments, and explain the main drivers. Be direct and specific.',
  forecast:  'You are a revenue forecasting expert. Based on this portfolio\'s current metrics, explain in 2–3 paragraphs: what drives the base-case 18% growth assumption, what would need to be true for the bull (25%) scenario, and what risks could materialise the bear (8%) case.',
  actions:   'You are a sales and retention strategist. Give exactly 3 specific, numbered, actionable recommendations for this team to prioritise in the next 90 days. For each: state the action, the expected impact, and how to measure success. Keep it tight and practical.',
};

async function callClaude(userContent) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.MODEL,
      max_tokens: CONFIG.MAX_TOKENS,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

async function runAI(type) {
  const statusEl = el('ai-status');
  const outputEl = el('ai-output');
  statusEl.style.display = 'flex';
  statusEl.className = 'status-bar status-loading';
  statusEl.innerHTML = '<span class="spinner"></span><span>Analysing your data with Claude…</span>';
  outputEl.style.display = 'none';

  try {
    const summary = buildDataSummary();
    const text    = await callClaude(AI_PROMPTS[type] + '\n\nData:\n' + summary);
    outputEl.textContent = text;
    outputEl.style.display = 'block';
    statusEl.style.display = 'none';
  } catch (err) {
    statusEl.className = 'status-bar status-error';
    statusEl.innerHTML = `<i class="ti ti-x"></i><span>${escapeHTML(err.message)}</span>`;
  }
}

async function askAI() {
  const q        = el('ai-question').value.trim();
  if (!q) return;
  const statusEl = el('ai-q-status');
  const outputEl = el('ai-q-output');
  statusEl.style.display = 'flex';
  statusEl.className = 'status-bar status-loading';
  statusEl.innerHTML = '<span class="spinner"></span><span>Thinking…</span>';
  outputEl.style.display = 'none';

  try {
    const summary = buildDataSummary();
    const prompt  = `You are a staffing business analyst. Answer this question about the portfolio concisely and specifically. Use only the data provided.\n\nQuestion: "${q}"\n\nData:\n${summary}`;
    const text    = await callClaude(prompt);
    outputEl.textContent = text;
    outputEl.style.display = 'block';
    statusEl.style.display = 'none';
  } catch (err) {
    statusEl.className = 'status-bar status-error';
    statusEl.innerHTML = `<i class="ti ti-x"></i><span>${escapeHTML(err.message)}</span>`;
    statusEl.style.display = 'flex';
  }
}

// ── JSON Export / Import ─────────────────────────────────────────────────────

function exportJSON() {
  const payload = {
    version: 1,
    exported: new Date().toISOString(),
    isLiveData,
    data: DATA,
    attritionData: ATTRITION_DATA,
    scenarios: SCENARIOS,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'dashboard-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  if (!file) return;
  el('upload-panel').style.display = 'block';
  showStatus('Reading ' + file.name + '…', 'loading');

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const payload = JSON.parse(e.target.result);
      if (!Array.isArray(payload.data) || payload.data.length === 0) {
        showStatus('Invalid JSON — no employee data found.', 'error');
        return;
      }
      DATA           = payload.data;
      ATTRITION_DATA = payload.attritionData || null;
      if (payload.scenarios) {
        SCENARIOS.base = payload.scenarios.base;
        SCENARIOS.bull = payload.scenarios.bull;
        SCENARIOS.bear = payload.scenarios.bear;
        _rateInputsSynced = false;
      }
      isLiveData = payload.isLiveData !== undefined ? payload.isLiveData : true;
      el('data-badge').className = 'data-source-badge ds-live';
      el('data-badge').innerHTML = '<i class="ti ti-database"></i> Live data';
      const dateStr = payload.exported ? ' · exported ' + payload.exported.slice(0, 10) : '';
      showStatus(`Loaded ${DATA.length} employees from ${file.name}${dateStr}`, 'success');
      refreshAll();
    } catch (err) {
      showStatus('JSON parse error: ' + err.message, 'error');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

// ── Slide Deck Generator ─────────────────────────────────────────────────────

let deckEmployees = null;

function initDeckGenerator() {
  const dropZone    = el('deck-drop-zone');
  const fileInput   = el('deck-file-input');
  const browseBtn   = el('deck-browse-btn');
  const currentBtn  = el('deck-use-current-btn');
  const generateBtn = el('deck-generate-btn');
  const downloadBtn = el('deck-download-btn');

  if (!dropZone || !fileInput || !browseBtn || !currentBtn || !generateBtn || !downloadBtn) return;

  dropZone.addEventListener('click', () => fileInput.click());

  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  currentBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    loadDeckData(DATA);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) parseDeckJSON(fileInput.files[0]);
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag');
    if (e.dataTransfer.files[0]) parseDeckJSON(e.dataTransfer.files[0]);
  });

  generateBtn.addEventListener('click', async () => {
    if (!deckEmployees) return;
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="spinner"></span> Building slides...';
    showDeckStatus('Building slides...', 'loading');
    try {
      await generateDeck(deckEmployees);
      el('deck-status').style.display = 'none';
      el('deck-result').style.display = 'block';
      el('deck-generate-section').style.display = 'none';
    } catch (err) {
      showDeckStatus('Error: ' + err.message, 'error');
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = '<i class="ti ti-sparkles"></i> Generate Director Slide Deck';
    }
  });

  downloadBtn.addEventListener('click', async () => {
    if (deckEmployees) await generateDeck(deckEmployees);
  });
}

function parseDeckJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const arr = Array.isArray(parsed) ? parsed
                : Array.isArray(parsed.employees) ? parsed.employees
                : Array.isArray(parsed.data) ? parsed.data
                : null;
      if (!arr || arr.length === 0) throw new Error('No employee array found in JSON.');
      loadDeckData(normaliseDeckEmployees(arr));
    } catch (err) {
      showDeckStatus('Parse error: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function normaliseDeckEmployees(arr) {
  const required = ['name', 'client', 'role', 'gm', 'annualRev', 'annualMargin', 'months', 'salary'];
  const normalised = arr.map(e => ({
    ...e,
    annualRev: e.annualRev ?? e.annualRevenue ?? 0,
    annualMargin: e.annualMargin ?? e.margin ?? 0,
  }));
  const invalid = normalised.find(e => required.some(key => e[key] === undefined || e[key] === null || e[key] === ''));
  if (invalid) {
    throw new Error('JSON does not match expected schema. Check it was exported from this dashboard.');
  }
  return normalised;
}

function loadDeckData(employees) {
  try {
    deckEmployees = normaliseDeckEmployees(employees);
  } catch (err) {
    showDeckStatus('Error: ' + err.message, 'error');
    return;
  }
  const badge = el('deck-loaded-badge');
  badge.style.display = 'flex';
  badge.innerHTML = `<i class="ti ti-check"></i><span>Loaded ${deckEmployees.length} employees — ready to generate</span>`;
  el('deck-status').style.display = 'none';
  el('deck-generate-section').style.display = 'block';
  el('deck-result').style.display = 'none';
}

function showDeckStatus(msg, type) {
  const statusEl = el('deck-status');
  statusEl.style.display = 'flex';
  statusEl.className = 'status-bar status-' + type;
  const icon = type === 'loading' ? '<span class="spinner"></span>'
             : type === 'error' ? '<i class="ti ti-x"></i>'
             : '<i class="ti ti-check"></i>';
  statusEl.innerHTML = `${icon}<span>${escapeHTML(msg)}</span>`;
}

// ── Boot ─────────────────────────────────────────────────────────────────────
(function init() {
  initOverview();
  resetFilters();
  renderPortfolio();
  initDeckGenerator();
  // Close fullscreen modal on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeChartFullscreen();
  });
})();
