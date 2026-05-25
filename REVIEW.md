# Code Review — Sales Decision Intelligence Dashboard

## Summary

Solid foundation for a no-build browser dashboard. Clean separation of concerns across four
files, good Chart.js hygiene (destroy-before-create), and the Excel parser is tolerant of the
real template's column spacing quirks. The main gaps are: (1) no real ML, (2) performance
issues that will hurt with larger datasets, and (3) several correctness bugs where the
dashboard shows the wrong numbers.

---

## Bugs (fix these first)

### B1 — `fmt()` is defined twice
**Files:** `charts.js` line 22, `dashboard.js` line 24

Both are identical now, but they'll drift as you change one and forget the other.

**Fix:** Delete `fmt` from `charts.js`. It already loads after `dashboard.js` so the global
is available. Or extract into a `src/utils.js` loaded first.

---

### B2 — Projection table GM% is hardcoded

**File:** `dashboard.js` line 161
```js
['GM %', '13.7%', '14.0%', '14.0%', '14.0%'],
```

This never reflects the actual portfolio GM%. If your data has 20% average GM, the table
still says 13.7%.

**Fix:**
```js
const actualGM = (DATA.reduce((s,e) => s + e.annualMargin, 0) /
                  DATA.reduce((s,e) => s + e.annualRev, 0) * 100).toFixed(1);
const projGM   = (parseFloat(actualGM) * 1.02).toFixed(1); // assume slight margin improvement
['GM %', actualGM + '%', projGM + '%', projGM + '%', projGM + '%'],
```

---

### B3 — Attrition margin row is also hardcoded

**File:** `dashboard.js` line 160
```js
['Annual margin', ...[hist[2] * 0.137, ...proj.map(v => v * 0.14)].map(fmt)],
```

Uses magic constants 0.137 / 0.14 regardless of actual GM. Same fix as B2 — derive from data.

---

### B4 — Filter dropdown duplicates on re-upload

**File:** `dashboard.js` `resetFilters()`

The function checks for existing values with `existC.has(c)` but reuses the same select
element without resetting it first. On second upload the old client options remain even if
they no longer exist in the new data.

**Fix:**
```js
function resetFilters() {
  const cSel = el('filter-client');
  const rSel = el('filter-role');
  // Clear everything except the "All" placeholder
  cSel.options.length = 1;
  rSel.options.length = 1;
  [...new Set(DATA.map(e => e.client))].sort().forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c; cSel.appendChild(o);
  });
  [...new Set(DATA.map(e => e.role))].sort().forEach(r => {
    const o = document.createElement('option'); o.value = r; o.textContent = r; rSel.appendChild(o);
  });
}
```

---

### B5 — Monthly run-rate chart ignores real monthly columns

**File:** `charts.js` `renderMonthlyChart()`

Your Excel `full_data` sheet has columns `May-26` through `Dec-26`. The chart ignores them
entirely and generates synthetic linear growth from annual revenue.

**Fix in `data.js`** — add monthly columns to the parser:
```js
const MONTHS_26 = ['May-26','June-26','July-26','Aug-26','Sept-26','Oct-26','Nov-26','Dec-26'];

// inside parseWorkbook, in the row loop:
const monthly26 = {};
MONTHS_26.forEach(m => { monthly26[m] = parseFloat(row[m]) || null; });
out.push({ ...existingFields, monthly26 });
```

Then aggregate in `renderMonthlyChart`:
```js
function renderMonthlyChart(data) {
  const monthKeys = ['May-26','June-26','July-26','Aug-26','Sept-26','Oct-26','Nov-26','Dec-26'];
  const labels    = ['May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mRevs = monthKeys.map(k => {
    const vals = data.map(e => e.monthly26?.[k]).filter(Boolean);
    return vals.length ? Math.round(vals.reduce((a,b) => a+b, 0)) : null;
  });
  // use mRevs instead of the synthetic calculation
}
```

---

## Performance issues

### P1 — `refreshAll()` renders all panels on upload, including hidden ones

**File:** `dashboard.js` line 84
```js
function refreshAll() {
  initOverview();
  renderForecast();    // panel is hidden
  renderAttrition();   // panel is hidden
  updateDecision();    // panel is hidden
  resetFilters();
  renderPortfolio();   // panel is hidden
}
```

7 chart renders and 5 DATA.reduce passes happen for panels the user isn't looking at.

**Fix:** Track which panels have been rendered. Lazy-render on tab open (you already do this
for `showPanel` — just skip the eager renders in `refreshAll`):
```js
const rendered = new Set();

function showPanel(id, btn) {
  // ... existing DOM logic ...
  if (!rendered.has(id)) {
    renderPanel(id);
    rendered.add(id);
  }
}

function renderPanel(id) {
  if (id === 'overview')  initOverview();
  if (id === 'forecast')  renderForecast();
  if (id === 'attrition') renderAttrition();
  if (id === 'decision')  updateDecision();
  if (id === 'portfolio') { resetFilters(); renderPortfolio(); }
}

function refreshAll() {
  rendered.clear();          // invalidate all panels
  renderPanel('overview');   // re-render only the visible one
  resetFilters();
}
```

---

### P2 — `buildDataSummary()` makes 7 separate passes over DATA

**File:** `dashboard.js` lines 309–319

Each `.reduce`, `.filter`, `.map` on DATA is a separate O(n) loop.

**Fix:** Single loop, compute everything at once:
```js
function buildDataSummary() {
  const clientRev = {}, highRisk = [], roles = new Set(), locs = new Set();
  let totalRev = 0, totalMargin = 0, totalSalary = 0, attrCount = 0,
      highGM = 0, lowGM = 0;

  for (const e of DATA) {
    totalRev    += e.annualRev;
    totalMargin += e.annualMargin;
    totalSalary += e.salary;
    clientRev[e.client] = (clientRev[e.client] || 0) + e.annualRev;
    roles.add(e.role);
    locs.add(e.loc);
    if (e.months < 8 || e.months > 42) attrCount++;
    if (e.months < 8 || e.gm < 12)     highRisk.push(e);
    if (e.gm > 18) highGM++;
    if (e.gm < 12) lowGM++;
  }
  const hc         = DATA.length;
  const attrRate   = Math.round(attrCount / hc * 100);
  const avgGM      = (totalMargin / totalRev * 100).toFixed(1);
  const avgSalary  = totalSalary / hc;
  const topClient  = Object.entries(clientRev).sort((a,b) => b[1]-a[1])[0];

  return `Staffing portfolio data:
- Headcount: ${hc}
...`; // same template as before
}
```

---

### P3 — No debounce on decision engine sliders

**File:** `index.html` — all four sliders have `oninput="updateDecision()"`

Every pixel of slider movement destroys and recreates the Chart.js canvas. On a slow machine
this causes visible lag.

**Fix:** Add a 16ms debounce (one animation frame):
```js
let decisionTimer = null;
function updateDecision() {
  clearTimeout(decisionTimer);
  decisionTimer = setTimeout(_updateDecision, 16);
}
function _updateDecision() {
  // ... existing logic ...
}
```

---

### P4 — `Math.min/max(...data.map(...))` spreads large arrays

**File:** `charts.js` line 278
```js
min: Math.max(0, Math.min(...data.map(e => e.gm)) - 2),
max: Math.max(...data.map(e => e.gm)) + 2
```

Spread syntax on arrays > ~10,000 elements throws a stack overflow. Use `reduce` instead:
```js
const gmMin = data.reduce((m, e) => Math.min(m, e.gm), Infinity);
const gmMax = data.reduce((m, e) => Math.max(m, e.gm), -Infinity);
```

---

## Model quality issues

### M1 — No real ML model exists

The "ML" in the dashboard is:
- Feature importance chart: **hardcoded constants** (0.35, 0.28, 0.18...)
- Attrition risk scores: **hand-crafted rule-based heuristic** (tenure + GM buckets)
- Forecast: **fixed growth rate multipliers** (18%, 15%, 12%)

This is fine for a prototype. For a real model:

**Option A (simplest, stays in-browser):**
Train a logistic regression in Python on your historic attrition data. Export the coefficients.
Apply in JS:
```js
// Standardise features, apply learned weights
function logisticRiskScore(e, weights, means, stds) {
  const features = [e.months, e.gm, e.salary, e.months < 6 ? 1 : 0];
  const z = features.reduce((sum, f, i) => sum + weights[i] * (f - means[i]) / stds[i], weights.bias);
  return 1 / (1 + Math.exp(-z)); // probability 0–1
}
```

**Option B (more power, requires backend):**
Train XGBoost/LightGBM in Python. Serve predictions via a FastAPI endpoint. Call it from
`dashboard.js` instead of the rule-based scorer.

**Option C (quick win, no backend):**
Use the Claude API itself. In `runAI('attrition')`, pass the full employee list as JSON
and ask Claude to rank by risk with reasoning. Much richer than the current heuristic.

---

### M2 — Historic data is synthetic, not read from your Excel

**File:** `dashboard.js` lines 133, 144
```js
const hist = [base2025Rev * 0.68, base2025Rev * 0.82, base2025Rev];
const hcH  = [Math.round(base2025HC * 0.72), Math.round(base2025HC * 0.85), base2025HC];
```

2023 and 2024 revenue/headcount are fabricated as 68% and 82% of the 2025 base.

**Fix:** Parse your `trend_analysis` sheet (it has 2023/2024/2025 rows) and use those real
numbers. Extend `parseWorkbook()` in `data.js` to return `{ employees, trend, attrition }`
and pass the trend data into `renderForecast()`.

---

## Security

### S1 — API key is on the client

`src/config.js` is served publicly. Anyone can open DevTools and read your Anthropic key.

For internal tooling this is acceptable short-term. For production:
- Add a simple Node/Python proxy (10 lines of Express/FastAPI)
- The browser calls `POST /api/analyse` on your server
- The server adds the API key and forwards to Anthropic

---

## Quick wins (easy, high impact)

| # | Change | Effort | Impact |
|---|---|---|---|
| 1 | Remove duplicate `fmt()` in charts.js | 2 min | Prevents future bugs |
| 2 | Fix projection table GM% (B2, B3) | 10 min | Dashboard shows correct numbers |
| 3 | Fix filter dropdown reset (B4) | 5 min | Correct after re-upload |
| 4 | Add slider debounce (P3) | 10 min | Smooth on slow machines |
| 5 | Single-loop `buildDataSummary` (P2) | 15 min | Faster AI tab, cleaner code |
| 6 | Parse `May-26`→`Dec-26` from Excel (B5) | 30 min | Real monthly chart |
| 7 | Lazy-render panels (P1) | 30 min | Faster file upload |
| 8 | Parse `trend_analysis` sheet (M2) | 1 hr | Real 2023/2024 historic data |

---

## Suggested file to add: `src/utils.js`

Load it first (before config.js) and put shared helpers there:
```js
// src/utils.js
function fmt(n) { ... }           // single source of truth
function debounce(fn, ms) { ... } // used by sliders
function sumBy(arr, key) { ... }  // replaces repeated .reduce((s,e) => s+e[key], 0)
function groupBy(arr, key) { ... } // replaces repeated {} accumulator patterns
```

Then load order in index.html:
```html
<script src="src/utils.js"></script>
<script src="src/config.js"></script>
<script src="src/data.js"></script>
<script src="src/charts.js"></script>
<script src="src/dashboard.js"></script>
```
