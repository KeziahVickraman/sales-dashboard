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

const SCENARIOS = {
  base: { growth: [0.18, 0.15, 0.12], hcGrowth: [0.20, 0.12, 0.10] },
  bull: { growth: [0.25, 0.22, 0.18], hcGrowth: [0.28, 0.20, 0.15] },
  bear: { growth: [0.08, 0.06, 0.05], hcGrowth: [0.05, 0.04, 0.03] },
};

// ── Utility ──────────────────────────────────────────────────────────────────

/** Format number as compact currency */
function fmt(n) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return '$' + Math.round(n / 1_000) + 'k';
  return '$' + Math.round(n);
}

function el(id) { return document.getElementById(id); }

// ── Navigation ───────────────────────────────────────────────────────────────
function showPanel(id, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el('panel-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  // Lazy-render on tab open
  if (id === 'forecast')  renderForecast();
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
  statusEl.innerHTML = `${icon}<span>${msg}</span>`;
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
  renderAttrition();
  resetFilters();
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
  const attrRate    = Math.round(DATA.filter(e => e.months < 8 || e.months > 42).length / hc * 100);

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

function renderForecast() {
  const sc          = SCENARIOS[currentScenario];
  const base2025Rev = DATA.reduce((s, e) => s + e.annualRev, 0);
  const base2025HC  = DATA.length;

  const hist = [base2025Rev * 0.68, base2025Rev * 0.82, base2025Rev];
  const proj = [hist[2] * (1 + sc.growth[0]), 0, 0];
  proj[1] = proj[0] * (1 + sc.growth[1]);
  proj[2] = proj[1] * (1 + sc.growth[2]);
  const cagr = (Math.pow(proj[2] / hist[2], 1 / 3) - 1) * 100;

  el('fc-26r').textContent = fmt(proj[0]);
  el('fc-27r').textContent = fmt(proj[1]);
  el('fc-28r').textContent = fmt(proj[2]);
  el('fc-cagr').textContent = cagr.toFixed(1) + '%';

  const hcH = [Math.round(base2025HC * 0.72), Math.round(base2025HC * 0.85), base2025HC];
  const hcP = [Math.round(base2025HC * (1 + sc.hcGrowth[0])), 0, 0];
  hcP[1] = Math.round(hcP[0] * (1 + sc.hcGrowth[1]));
  hcP[2] = Math.round(hcP[1] * (1 + sc.hcGrowth[2]));

  const rprH = hist.map((r, i) => r / hcH[i]);
  const rprP = proj.map((r, i) => r / hcP[i]);

  renderForecastChart(hist, proj);
  renderHeadcountForecastChart(hcH, hcP);
  renderRPRChart(rprH, rprP);

  // Projection table
  const rows = [
    ['Headcount',          ...[base2025HC, ...hcP].map(Math.round)],
    ['Annual revenue',     ...[hist[2], ...proj].map(fmt)],
    ['Annual margin',      ...[hist[2] * 0.137, ...proj.map(v => v * 0.14)].map(fmt)],
    ['GM %',               '13.7%', '14.0%', '14.0%', '14.0%'],
    ['Revenue / resource', ...[hist[2] / base2025HC, ...rprP].map(fmt)],
  ];
  el('proj-tbody').innerHTML = rows
    .map((r, i) => `<tr class="${i === 1 || i === 2 ? 'bold' : ''}">${r.map(c => `<td>${c}</td>`).join('')}</tr>`)
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
      <td>${e.name}</td>
      <td>${e.role}</td>
      <td>${e.months}mo</td>
      <td>${fmt(e.annualRev)}</td>
      <td>${e.gm.toFixed(1)}%</td>
      <td><strong>${e.riskScore}</strong></td>
      <td><span class="badge ${hClass}">${hLabel}</span> <span style="font-size:11px;color:var(--color-text-secondary)">${sig}</span></td>
    </tr>`;
  }).join('');

  renderFeatureImportanceChart();
}

// ── Decision Engine ──────────────────────────────────────────────────────────
function updateDecision() {
  const p    = parseInt(el('sl-p').value) / 100;
  const cr   = parseInt(el('sl-cr').value);
  const cp   = parseInt(el('sl-cp').value);
  const lift = parseInt(el('sl-lift').value) / 100;

  el('out-p').textContent    = Math.round(p * 100) + '%';
  el('out-cr').textContent   = fmt(cr);
  el('out-cp').textContent   = fmt(cp);
  el('out-lift').textContent = Math.round(lift * 100) + '%';

  const costNothing = p * cr;
  const costOffer   = cp + (p - lift * p) * cr;
  const pStar       = lift > 0 ? cp / (cr * lift) : 1;
  const savings     = costNothing - costOffer;

  el('dec-nothing').textContent    = fmt(costNothing);
  el('dec-offer-cost').textContent = fmt(costOffer);
  el('dec-pstar').textContent      = Math.round(pStar * 100) + '%';
  el('dec-savings').textContent    = (savings > 0 ? '+' : '') + fmt(savings);

  el('formula-out').textContent =
    `Offer iff p > C_package / (C_replace × lift)  =  ${fmt(cp)} / (${fmt(cr)} × ${Math.round(lift * 100)}%)  =  ${Math.round(pStar * 100)}%`;

  const box   = el('decision-result');
  const title = el('dec-title');
  const sub   = el('dec-sub');
  box.className = 'decision-box';

  if (p > pStar) {
    box.classList.add('decision-offer');
    title.textContent = 'Offer the retention package';
    sub.textContent   = `p (${Math.round(p * 100)}%) exceeds break-even p* (${Math.round(pStar * 100)}%). Expected net saving: ${fmt(savings)}.`;
  } else if (p > pStar * 0.85) {
    box.classList.add('decision-hold');
    title.textContent = 'Borderline — review carefully';
    sub.textContent   = `p (${Math.round(p * 100)}%) ≈ p* (${Math.round(pStar * 100)}%). Consider non-monetary levers first.`;
  } else {
    box.classList.add('decision-risk');
    title.textContent = 'Do not offer — not cost-justified';
    sub.textContent   = `p (${Math.round(p * 100)}%) < p* (${Math.round(pStar * 100)}%). Package cost exceeds expected replacement saving.`;
  }

  renderDecisionChart(cr, cp, lift);
}

// ── Portfolio ────────────────────────────────────────────────────────────────
function populateFilter(selectId, field) {
  const sel = el(selectId);
  if (!sel) return;
  const existing = new Set(Array.from(sel.options).map(o => o.value));
  [...new Set(DATA.map(e => e[field]))].sort().forEach(v => {
    if (!existing.has(v)) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    }
  });
}

function resetFilters() {
  populateFilter('filter-client', 'client');
  populateFilter('filter-role',   'role');
  populateFilter('tr-client',     'client');
  populateFilter('tr-role',       'role');
  populateFilter('tr-loc',        'loc');
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
      <td>${e.name}</td>
      <td>${e.client}</td>
      <td>${e.role}</td>
      <td>${e.loc}</td>
      <td>${e.months}mo</td>
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
  el('tr-tbody').innerHTML = tableRows.map((p, i) => {
    const prevP = i > 0 ? tableRows[i - 1] : null;
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

// ── AI Insights ──────────────────────────────────────────────────────────────

/** Build a compact plain-text summary of the current data for the AI prompt */
function buildDataSummary() {
  const totalRev    = DATA.reduce((s, e) => s + e.annualRev, 0);
  const totalMargin = DATA.reduce((s, e) => s + e.annualMargin, 0);
  const hc          = DATA.length;
  const attrRate    = Math.round(DATA.filter(e => e.months < 8 || e.months > 42).length / hc * 100);
  const avgGM       = (totalMargin / totalRev * 100).toFixed(1);
  const topClient   = Object.entries(DATA.reduce((m, e) => { m[e.client] = (m[e.client] || 0) + e.annualRev; return m; }, {}))
                        .sort((a, b) => b[1] - a[1])[0];
  const avgSalary   = DATA.reduce((s, e) => s + e.salary, 0) / hc;
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
  if (!CONFIG.ANTHROPIC_API_KEY || CONFIG.ANTHROPIC_API_KEY === 'YOUR_API_KEY_HERE') {
    throw new Error('API key not set. Edit src/config.js and add your Anthropic API key.');
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CONFIG.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
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
    statusEl.innerHTML = `<i class="ti ti-x"></i><span>${err.message}</span>`;
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
    statusEl.innerHTML = `<i class="ti ti-x"></i><span>${err.message}</span>`;
    statusEl.style.display = 'flex';
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────────
(function init() {
  initOverview();
  resetFilters();
  renderPortfolio();
})();
