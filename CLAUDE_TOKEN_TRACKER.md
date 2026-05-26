# Claude Code Task: Token Usage & Cost Calculator — AI Insights Tab

## Context

Read `CLAUDE.md` first for the full codebase map.

The dashboard is a zero-build vanilla JS single-page app. The relevant files:
- `index.html` — HTML panels. The AI Insights panel is `<section id="panel-ai">`
- `src/styles.css` — all styles
- `src/dashboard.js` — all app logic. The AI functions are `callClaude()`, `runAI()`, `askAI()`
- `src/config.js` — `CONFIG` object with `MODEL` and `MAX_TOKENS`
- `api/claude.js` — Vercel serverless proxy (already handles the real API call)

---

## What to build

A collapsible **"Token Usage & Cost Calculator"** section at the very bottom of `#panel-ai`,
below the Bonus / Slide Deck Generator section.

It tracks every API call made in the session, shows a running cost total, and lets the user
set a session budget cap with a warning when approaching it.

---

## Pricing constants to hardcode

Anthropic Claude Sonnet 4 pricing (as of mid-2026, per 1M tokens):

```js
const PRICING = {
  'claude-sonnet-4-20250514': { input: 3.00,  output: 15.00 },
  'claude-opus-4-20250514':   { input: 15.00, output: 75.00 },
  'claude-haiku-4-5-20251001':{ input: 0.80,  output: 4.00  },
};
// Fallback if model not found
const DEFAULT_PRICE = { input: 3.00, output: 15.00 };
```

Cost formula:
```js
const cost = (inputTokens / 1_000_000 * price.input) + (outputTokens / 1_000_000 * price.output);
```

---

## Step 1 — Modify `callClaude()` in `src/dashboard.js`

**Current:** `callClaude(userContent)` returns a string (the text response).

**Change:** Return an object `{ text, usage }` instead, where `usage` comes from the
`usage` field Anthropic includes in every response:

```js
// Anthropic response shape:
{
  content: [{ type: 'text', text: '...' }],
  usage: {
    input_tokens: 245,
    output_tokens: 312
  },
  model: 'claude-sonnet-4-20250514'
}
```

Updated `callClaude`:
```js
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
  const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return {
    text,
    usage: data.usage || { input_tokens: 0, output_tokens: 0 },
    model: data.model || CONFIG.MODEL,
  };
}
```

**Then update every caller** to destructure `{ text, usage, model }` and pass usage to
`recordUsage(label, usage, model)` after each successful call:

In `runAI(type)`:
```js
const { text, usage, model } = await callClaude(AI_PROMPTS[type] + '\n\nData:\n' + summary);
outputEl.textContent = text;
recordUsage(AI_PROMPT_LABELS[type], usage, model);  // ADD THIS
```

In `askAI()`:
```js
const { text, usage, model } = await callClaude(prompt);
outputEl.textContent = text;
recordUsage('Q: ' + q.slice(0, 40) + (q.length > 40 ? '…' : ''), usage, model);  // ADD THIS
```

Also add a label map for the button types at the top of the AI section:
```js
const AI_PROMPT_LABELS = {
  summary:   'Portfolio Summary',
  attrition: 'Attrition Analysis',
  forecast:  'Forecast Rationale',
  actions:   'Top 3 Actions',
};
```

If `generateDeck()` in `slides.js` makes any Claude API calls, update those too.

---

## Step 2 — Token tracking state in `src/dashboard.js`

Add this state near the top of the AI section, alongside `AI_PROMPTS`:

```js
// ── Token usage tracking ──────────────────────────────────────────────────────
const SESSION_USAGE = [];   // array of call records, grows through the session

const PRICING = {
  'claude-sonnet-4-20250514':  { input: 3.00,  output: 15.00 },
  'claude-opus-4-20250514':    { input: 15.00, output: 75.00 },
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00  },
};
const DEFAULT_PRICE = { input: 3.00, output: 15.00 };

let sessionBudgetUSD = 1.00;   // default $1.00 cap, user can change

function recordUsage(label, usage, model) {
  const price = PRICING[model] || DEFAULT_PRICE;
  const cost  = (usage.input_tokens  / 1_000_000 * price.input)
              + (usage.output_tokens / 1_000_000 * price.output);
  SESSION_USAGE.push({
    label,
    model,
    inputTokens:  usage.input_tokens,
    outputTokens: usage.output_tokens,
    cost,
    timestamp: new Date(),
  });
  renderUsageTracker();
  checkBudgetWarning();
}

function sessionTotals() {
  return SESSION_USAGE.reduce(
    (acc, r) => ({
      inputTokens:  acc.inputTokens  + r.inputTokens,
      outputTokens: acc.outputTokens + r.outputTokens,
      cost:         acc.cost         + r.cost,
      calls:        acc.calls        + 1,
    }),
    { inputTokens: 0, outputTokens: 0, cost: 0, calls: 0 }
  );
}
```

---

## Step 3 — Add UI section to `index.html`

At the very bottom of `<section id="panel-ai">`, after the Slide Deck Generator card
(or after the AI ask card if the deck feature isn't implemented yet), add:

```html
<!-- Token Usage & Cost Calculator -->
<div class="bonus-divider" id="usage-divider">
  <span>💰 Token Usage & Cost</span>
</div>

<div class="card" id="usage-tracker-card">
  <!-- Collapsible header -->
  <button class="usage-collapse-btn" id="usage-collapse-btn" onclick="toggleUsagePanel()" aria-expanded="true">
    <div class="usage-header-left">
      <i class="ti ti-receipt"></i>
      <span class="usage-header-title">Session Usage Tracker</span>
      <span class="usage-live-badge" id="usage-live-badge" style="display:none">
        <span class="usage-live-dot"></span> LIVE
      </span>
    </div>
    <div class="usage-header-right">
      <span id="usage-header-summary">No calls yet</span>
      <i class="ti ti-chevron-up usage-chevron" id="usage-chevron"></i>
    </div>
  </button>

  <!-- Collapsible body -->
  <div id="usage-panel-body">

    <!-- Budget cap control -->
    <div class="usage-budget-row">
      <label class="usage-budget-label" for="budget-input">
        <i class="ti ti-target"></i> Session budget cap (USD)
      </label>
      <div class="usage-budget-controls">
        <span class="usage-budget-prefix">$</span>
        <input type="number" id="budget-input" value="1.00" min="0.10" max="50" step="0.10"
               onchange="updateBudget(this.value)" />
      </div>
    </div>

    <!-- Budget progress bar -->
    <div class="usage-progress-wrap" id="usage-progress-wrap">
      <div class="usage-progress-track">
        <div class="usage-progress-fill" id="usage-progress-fill"></div>
      </div>
      <div class="usage-progress-labels">
        <span id="usage-progress-spent">$0.0000 spent</span>
        <span id="usage-progress-remaining"></span>
      </div>
    </div>

    <!-- Warning banner (hidden until near budget) -->
    <div class="usage-warning" id="usage-warning" style="display:none">
      <i class="ti ti-alert-triangle"></i>
      <span id="usage-warning-text"></span>
    </div>

    <!-- KPI row -->
    <div class="usage-kpi-row" id="usage-kpi-row">
      <div class="usage-kpi">
        <div class="usage-kpi-val" id="u-calls">0</div>
        <div class="usage-kpi-label">API calls</div>
      </div>
      <div class="usage-kpi">
        <div class="usage-kpi-val" id="u-input">0</div>
        <div class="usage-kpi-label">Input tokens</div>
      </div>
      <div class="usage-kpi">
        <div class="usage-kpi-val" id="u-output">0</div>
        <div class="usage-kpi-label">Output tokens</div>
      </div>
      <div class="usage-kpi">
        <div class="usage-kpi-val" id="u-total">0</div>
        <div class="usage-kpi-label">Total tokens</div>
      </div>
      <div class="usage-kpi usage-kpi-cost">
        <div class="usage-kpi-val" id="u-cost">$0.0000</div>
        <div class="usage-kpi-label">Session cost</div>
      </div>
    </div>

    <!-- Call log table -->
    <div id="usage-log-wrap" style="display:none">
      <div class="usage-log-header">
        <span class="usage-log-title">Call log</span>
        <button class="btn-outline" style="font-size:11px; padding:3px 10px;"
                onclick="exportUsageCSV()">
          <i class="ti ti-download"></i> Export CSV
        </button>
      </div>
      <div style="overflow-x:auto">
        <table class="emp-table" id="usage-log-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Model</th>
              <th style="text-align:right">Input</th>
              <th style="text-align:right">Output</th>
              <th style="text-align:right">Cost (USD)</th>
            </tr>
          </thead>
          <tbody id="usage-log-tbody"></tbody>
        </table>
      </div>
    </div>

    <!-- Empty state -->
    <div id="usage-empty" style="text-align:center; padding:1.5rem 0; color:var(--color-text-secondary); font-size:13px;">
      <i class="ti ti-robot" style="font-size:24px; display:block; margin-bottom:8px; opacity:.4"></i>
      Make your first AI call above to start tracking usage
    </div>

    <!-- Reset button -->
    <div style="text-align:right; margin-top:0.75rem;" id="usage-reset-wrap" style="display:none">
      <button class="btn-outline" style="font-size:12px;" onclick="resetUsage()">
        <i class="ti ti-trash"></i> Reset session
      </button>
    </div>

  </div><!-- /usage-panel-body -->
</div><!-- /usage-tracker-card -->
```

---

## Step 4 — Add CSS to `src/styles.css`

```css
/* ── Token Usage Tracker ── */
.usage-collapse-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: none;
  border: none;
  padding: 0 0 0.75rem 0;
  cursor: pointer;
  border-bottom: 0.5px solid var(--color-border);
  margin-bottom: 1rem;
  gap: 8px;
}
.usage-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}
.usage-header-title { font-size: 13px; font-weight: 500; }
.usage-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.usage-chevron { transition: transform .2s; font-size: 14px; }
.usage-chevron.collapsed { transform: rotate(180deg); }

.usage-live-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #EAF3DE;
  color: #27500A;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 99px;
  letter-spacing: 0.05em;
}
.usage-live-dot {
  width: 6px;
  height: 6px;
  background: #1D9E75;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

.usage-budget-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 8px;
}
.usage-budget-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.usage-budget-controls {
  display: flex;
  align-items: center;
  border: 0.5px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.usage-budget-prefix {
  padding: 6px 8px;
  background: var(--color-bg-secondary);
  font-size: 13px;
  color: var(--color-text-secondary);
  border-right: 0.5px solid var(--color-border);
}
.usage-budget-controls input {
  padding: 6px 10px;
  border: none;
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-size: 13px;
  width: 80px;
}
.usage-budget-controls input:focus { outline: none; }

.usage-progress-wrap { margin-bottom: 12px; }
.usage-progress-track {
  height: 6px;
  background: var(--color-bg-secondary);
  border-radius: 99px;
  overflow: hidden;
  margin-bottom: 4px;
}
.usage-progress-fill {
  height: 100%;
  border-radius: 99px;
  background: #1D9E75;
  transition: width .4s ease, background .3s;
  width: 0%;
}
.usage-progress-fill.warn   { background: #BA7517; }
.usage-progress-fill.danger { background: #E24B4A; }
.usage-progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.usage-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  background: #FAEEDA;
  color: #633806;
  font-size: 12px;
  margin-bottom: 12px;
}
.usage-warning.danger { background: #FCEBEB; color: #791F1F; }

.usage-kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 8px;
  margin-bottom: 1rem;
}
.usage-kpi {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  text-align: center;
}
.usage-kpi-val {
  font-size: 18px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 2px;
}
.usage-kpi-cost .usage-kpi-val { color: #1D9E75; }
.usage-kpi-label { font-size: 10px; color: var(--color-text-secondary); }

.usage-log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.usage-log-title {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}
```

---

## Step 5 — Add functions to `src/dashboard.js`

Add these functions in the `// ── Token usage tracking ──` section, after `sessionTotals()`:

```js
function renderUsageTracker() {
  const totals = sessionTotals();
  const pct    = Math.min(totals.cost / sessionBudgetUSD * 100, 100);

  // Header summary (collapsed view)
  el('usage-header-summary').textContent =
    totals.calls > 0
      ? `${totals.calls} call${totals.calls > 1 ? 's' : ''} · $${totals.cost.toFixed(4)}`
      : 'No calls yet';

  // Live badge
  el('usage-live-badge').style.display = totals.calls > 0 ? 'inline-flex' : 'none';

  // KPIs
  el('u-calls').textContent  = totals.calls;
  el('u-input').textContent  = totals.inputTokens.toLocaleString();
  el('u-output').textContent = totals.outputTokens.toLocaleString();
  el('u-total').textContent  = (totals.inputTokens + totals.outputTokens).toLocaleString();
  el('u-cost').textContent   = '$' + totals.cost.toFixed(4);

  // Progress bar
  const fill = el('usage-progress-fill');
  fill.style.width = pct + '%';
  fill.className = 'usage-progress-fill' + (pct >= 90 ? ' danger' : pct >= 70 ? ' warn' : '');
  el('usage-progress-spent').textContent    = `$${totals.cost.toFixed(4)} spent`;
  el('usage-progress-remaining').textContent = `$${sessionBudgetUSD.toFixed(2)} cap`;

  // Empty state vs log
  el('usage-empty').style.display         = totals.calls === 0 ? 'block' : 'none';
  el('usage-log-wrap').style.display      = totals.calls > 0  ? 'block' : 'none';
  el('usage-reset-wrap').style.display    = totals.calls > 0  ? 'block' : 'none';

  // Log table
  const tbody = el('usage-log-tbody');
  tbody.innerHTML = [...SESSION_USAGE].reverse().map(r => {
    const time = r.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `<tr>
      <td style="font-size:11px; color:var(--color-text-secondary)">${time}</td>
      <td>${r.label}</td>
      <td style="font-size:11px; color:var(--color-text-secondary)">${r.model.replace('claude-','').replace(/-\d{8}$/,'')}</td>
      <td style="text-align:right">${r.inputTokens.toLocaleString()}</td>
      <td style="text-align:right">${r.outputTokens.toLocaleString()}</td>
      <td style="text-align:right; font-weight:500; color:#1D9E75">$${r.cost.toFixed(4)}</td>
    </tr>`;
  }).join('');
}

function checkBudgetWarning() {
  const totals  = sessionTotals();
  const pct     = totals.cost / sessionBudgetUSD * 100;
  const warning = el('usage-warning');
  if (pct >= 100) {
    warning.style.display = 'flex';
    warning.className = 'usage-warning danger';
    el('usage-warning-text').textContent =
      `Budget cap of $${sessionBudgetUSD.toFixed(2)} reached. Further calls will still work but costs are accumulating.`;
  } else if (pct >= 80) {
    warning.style.display = 'flex';
    warning.className = 'usage-warning';
    el('usage-warning-text').textContent =
      `${Math.round(pct)}% of your $${sessionBudgetUSD.toFixed(2)} session budget used — $${(sessionBudgetUSD - totals.cost).toFixed(4)} remaining.`;
  } else {
    warning.style.display = 'none';
  }
}

function updateBudget(val) {
  const v = parseFloat(val);
  if (!isNaN(v) && v > 0) {
    sessionBudgetUSD = v;
    renderUsageTracker();
    checkBudgetWarning();
  }
}

function toggleUsagePanel() {
  const body    = el('usage-panel-body');
  const chevron = el('usage-chevron');
  const btn     = el('usage-collapse-btn');
  const isOpen  = body.style.display !== 'none';
  body.style.display    = isOpen ? 'none' : 'block';
  chevron.classList.toggle('collapsed', isOpen);
  btn.setAttribute('aria-expanded', String(!isOpen));
}

function resetUsage() {
  SESSION_USAGE.length = 0;
  renderUsageTracker();
  el('usage-warning').style.display = 'none';
}

function exportUsageCSV() {
  const totals = sessionTotals();
  const rows   = [
    ['Time', 'Action', 'Model', 'Input Tokens', 'Output Tokens', 'Cost (USD)'],
    ...SESSION_USAGE.map(r => [
      r.timestamp.toISOString(),
      r.label,
      r.model,
      r.inputTokens,
      r.outputTokens,
      r.cost.toFixed(6),
    ]),
    [],
    ['TOTAL', '', '', totals.inputTokens, totals.outputTokens, totals.cost.toFixed(6)],
  ];
  const csv  = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `dashboard-usage-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

Also call `renderUsageTracker()` once at the end of the boot IIFE so the empty state
renders on page load:
```js
(function init() {
  initOverview();
  resetFilters();
  renderPortfolio();
  updateDecision();
  renderUsageTracker();  // ADD THIS
})();
```

---

## Files to modify

| File | Change |
|---|---|
| `src/dashboard.js` | (1) Update `callClaude()` to return `{ text, usage, model }`. (2) Add `AI_PROMPT_LABELS`. (3) Update `runAI()` and `askAI()` callers to destructure and call `recordUsage()`. (4) Add token state: `SESSION_USAGE`, `PRICING`, `DEFAULT_PRICE`, `sessionBudgetUSD`. (5) Add functions: `recordUsage`, `sessionTotals`, `renderUsageTracker`, `checkBudgetWarning`, `updateBudget`, `toggleUsagePanel`, `resetUsage`, `exportUsageCSV`. (6) Call `renderUsageTracker()` in boot IIFE. |
| `index.html` | Add the full usage tracker HTML block at the bottom of `#panel-ai` |
| `src/styles.css` | Add all `/* ── Token Usage Tracker ── */` styles |

No new files needed. No new CDN dependencies.

---

## Verification checklist

- [ ] Page loads cleanly, usage section shows empty state "Make your first AI call above"
- [ ] Click "Portfolio Summary" → section updates with 1 call, token counts, cost in green
- [ ] Call log shows the entry with correct time, action label, model name, and cost
- [ ] Budget progress bar fills proportionally, turns amber at 70%, red at 90%
- [ ] Warning banner appears at 80% of budget cap
- [ ] Changing budget input to $0.10 and having $0.05 spent shows the warning immediately
- [ ] Collapse button hides the body, chevron rotates, re-click expands
- [ ] Header summary shows "N calls · $X.XXXX" when collapsed
- [ ] "Export CSV" downloads a correctly formatted CSV with all rows + totals
- [ ] "Reset session" clears the log and resets all KPIs to zero
- [ ] LIVE badge pulses green when there are active calls in the log
- [ ] Dark mode: all elements readable (check warning banners and progress bar)

---

## Notes

- The budget cap is a **soft warning only** — it does not block API calls. This is intentional;
  blocking mid-session would be disruptive. The warning is enough for the user to self-regulate.
- Token counts come directly from Anthropic's `usage` field in the response — they are exact,
  not estimated.
- The `SESSION_USAGE` array is in-memory only and resets on page refresh. This is intentional
  for a client-side app — no backend storage needed.
- If you later want **persistent usage tracking across sessions**, store `SESSION_USAGE` in
  `localStorage` with a date key and aggregate by day. That's a natural v2 extension.
- Model name in the log is shortened for display: `claude-sonnet-4-20250514` →
  `sonnet-4` by stripping the `claude-` prefix and the date suffix.
