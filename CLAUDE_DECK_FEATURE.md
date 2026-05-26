# Claude Code Task: Add "Slide Deck Generator" to the AI Insights Tab

## Context

This is the `sales-dashboard` project. Read `CLAUDE.md` first for the full codebase map.

The dashboard is a zero-build vanilla JS single-page app:
- `index.html` — all HTML panels and nav tabs
- `src/styles.css` — all styles
- `src/dashboard.js` — app state, render functions, AI calls
- `src/charts.js` — Chart.js render helpers
- `src/data.js` — demo seed data + Excel parser
- `src/config.js` — Anthropic API key config

The last tab is "AI Insights" (`#panel-ai`). We need to add a **"🎁 Bonus — Slide Deck Generator"**
section at the bottom of that panel.

---

## What to build

### Feature: Slide Deck Generator inside the AI Insights tab

A self-contained section at the bottom of `#panel-ai` that:

1. **Accepts a JSON upload** — user clicks a drop zone or browse button, selects the
   `.json` file exported from the dashboard (the same `DATA` array the dashboard uses).
   Also has a **"Use current dashboard data"** button that skips the upload and directly
   uses the live `DATA` array in memory.

2. **Parses the JSON** — validates it contains the expected employee array shape
   (`name`, `client`, `role`, `gm`, `annualRev`, `annualMargin`, `months`, `salary`).
   Shows a green confirmation badge: "Loaded N employees" or an error if invalid.

3. **Generates a 5-slide `.pptx` file** using **PptxGenJS loaded from CDN** and
   **triggers a browser download** of `director_briefing.pptx`.

4. Shows a progress state ("Building slides…") while generating, then a success state
   with a download button that re-triggers the download.

---

## Exact slide content to generate

Use the **Midnight Executive palette** throughout:
```
navy:   "1E2761"   ← dark navy (backgrounds, headers)
ice:    "CADCFC"   ← pale blue (secondary text)
white:  "FFFFFF"
slate:  "64748B"   ← muted text
light:  "F1F5FB"   ← light bg
green:  "1D9E75"
red:    "E24B4A"
amber:  "BA7517"
accent: "378ADD"   ← blue
```

Compute these aggregates from the uploaded/live employee array before building:
```js
const totalRev    = employees.reduce((s,e) => s + e.annualRev, 0);
const totalMargin = employees.reduce((s,e) => s + e.annualMargin, 0);
const avgGM       = (totalMargin / totalRev * 100).toFixed(1);
const hc          = employees.length;
const rpr         = Math.round(totalRev / hc);
const attrRate    = Math.round(employees.filter(e => e.months < 8 || e.months > 42).length / hc * 100);
const avgSalary   = Math.round(employees.reduce((s,e) => s + e.salary, 0) / hc);

// Role breakdown
const roles = [...new Set(employees.map(e => e.role))].sort();
const roleData = roles.map(role => {
  const emps = employees.filter(e => e.role === role);
  return {
    role,
    hc: emps.length,
    rev: emps.reduce((s,e) => s + e.annualRev, 0),
  };
});

// Client breakdown
const clients = [...new Set(employees.map(e => e.client))].sort();
const clientData = clients.map(client => {
  const emps = employees.filter(e => e.client === client);
  return {
    client,
    hc: emps.length,
    rev: emps.reduce((s,e) => s + e.annualRev, 0),
  };
});

// Projections (base case: 18% / 15% / 12%)
const proj = {
  rev:  [Math.round(totalRev*1.18), Math.round(totalRev*1.18*1.15), Math.round(totalRev*1.18*1.15*1.12)],
  hc:   [Math.round(hc*1.20),       Math.round(hc*1.20*1.12),       Math.round(hc*1.20*1.12*1.10)],
};
const cagr = ((Math.pow(proj.rev[2]/totalRev, 1/3) - 1)*100).toFixed(1);

// Historic (synthetic 2023/2024 back-discounted at 12% YoY)
const hist = {
  rev: [Math.round(totalRev/1.12/1.12), Math.round(totalRev/1.12), totalRev],
  hc:  [Math.round(hc*0.72),             Math.round(hc*0.85),       hc],
};

// Revenue at risk and replacement cost
const revAtRisk = Math.round(totalRev * (attrRate/100));
const replCost  = Math.round(avgSalary * 0.5 * hc * attrRate/100);

// Currency formatter
function fmt(n) {
  if (n >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + Math.round(n/1e3) + 'k';
  return '$' + n;
}
```

### Slide 1 — Cover (dark navy background)
- Top-right geometric accent: two semi-transparent rectangles (accent blue + ice)
- Eyebrow text: `"DIRECTOR BRIEFING  ·  FY 2025 – 2028"` (9pt, ice, charSpacing 4)
- Title: `"Sales Portfolio\nPerformance &\nStrategic Outlook"` (40pt bold white)
- Subtitle: `"Headcount · Revenue · Attrition · 3-Year Forecast"` (13pt ice)
- Four KPI pills (semi-transparent accent rectangles) at bottom:
  - Headcount `hc`, Annual Rev `fmt(totalRev)`, Avg GM% `avgGM+"%"`, Attrition `attrRate+"%"`
  - Each pill: large value (18pt bold white) + small label (7.5pt ice, charSpacing 2)
- Footer: `"As of [current month year]"` (9pt slate)

### Slide 2 — Portfolio Snapshot (white background, left dark panel)
- Left column (x:0, w:3.4, full height): navy rectangle
  - Slide number "02" (28pt accent)
  - "PORTFOLIO\nSNAPSHOT" label (13pt bold white, charSpacing 2)
  - 5 KPI rows (semi-transparent accent bg rectangles):
    Total Headcount, Annual Revenue, Annual Margin, Avg Gross Margin, Revenue per Resource
- Right column:
  - Title: `"Revenue by Role Category"` (17pt bold navy)
  - Subtitle: `"FY [year] actuals · [hc] active placements across [clientCount] clients"` (10pt slate)
  - Horizontal bar chart (`pres.charts.BAR`, `barDir:'bar'`):
    - labels: role names, values: role revenues
    - colors: `["378ADD","1D9E75","BA7517","1E2761"]`
    - showValue: true, dataLabelFormatCode: `'"$"#,##0'`
  - Client distribution table below chart:
    - Header row: Client | HC | Annual Revenue (navy fill, white text)
    - Data rows: one per client with fmt(rev) right-aligned

### Slide 3 — Revenue Trend & 3-Year Forecast (light background)
- Full-width navy header band (h:1.05"):
  - "03" (22pt accent), "REVENUE TREND & 3-YEAR FORECAST" (13pt bold white, charSpacing 2)
  - Right-aligned: "Base case · 18% / 15% / 12% YoY growth" (8pt ice)
- Left 60%: Combo chart (BAR historic + LINE projected), years 2023-2028
  - Historic bars: accent blue, nulls for 2026-2028
  - Projected line: green, bridging from 2025 value, showValue true
  - Legend at bottom
  - valAxisNumericFormat: `'"$"#,##0'`
- Right 35%: "Projected Targets" heading + 3 white cards with left accent bar:
  - 2026: `fmt(proj.rev[0])`, HC: proj.hc[0], GM: "14.0%" (accent left bar)
  - 2027: `fmt(proj.rev[1])`, HC: proj.hc[1], GM: "14.0%" (green left bar)
  - 2028: `fmt(proj.rev[2])`, HC: proj.hc[2], GM: "14.0%" (amber left bar)
  - Shadow: `{ type:"outer", blur:8, offset:2, angle:135, color:"000000", opacity:0.07 }`
- Bottom navy callout bar:
  - `"3-Year CAGR  →  +[cagr]%"` (13pt bold white)
  - `"Revenue per resource grows from [fmt(rpr)] to [fmt(proj.rev[2]/proj.hc[2])]"` (9.5pt ice)

### Slide 4 — Attrition Intelligence (white background)
- Full-width navy header band identical to slide 3 pattern:
  - "04" (22pt red), "ATTRITION INTELLIGENCE" (13pt bold white), "Risk · Cost · Retention Decisions" (8pt ice right)
- Left 45%: line chart — Attrition % vs Retention % for 2023/2024/2025
  - attrition values: compute from hist.hc ratios or use [11, 20, attrRate]
  - retention values: [89, 80, 100-attrRate]
  - colors: red + green, lineSize:2.5, showValue:true, valAxisMaxVal:100
- Right 45%: horizontal bar chart — attrition rate by role
  - Use roleData; attrition per role = roles with higher tenure get lower attrition
  - Color each bar: >15% → red, else → amber
  - showValue:true, dataLabelFormatCode:`'0"%"'`
- Bottom: 3 navy impact cards (full-width split in thirds):
  - Revenue at Risk: `fmt(revAtRisk)` (red value)
  - Est. Replacement Cost: `fmt(replCost)` (amber value)
  - Break-Even Offer p*: `"~27%"` (accent value)
  - Each card: top accent stripe, large value, bold label, small sub-text
  - Sub-text: "17% attrition × total rev" / "0.5× avg salary per leaver" / "C_pkg=$8k / (C_repl×lift 40%)"

### Slide 5 — Strategic Recommendations (dark navy background)
- Top-right geometric accent rectangle (semi-transparent accent)
- "05" (22pt accent), "STRATEGIC RECOMMENDATIONS" (12pt bold ice, charSpacing 3)
- Subtitle: "Priority actions for the next 90 days" (11pt ice)
- 4 recommendations with numbered oval badges:
  1. **Red badge** — "Defend Software Engineers — highest attrition risk"
     Body: "22% attrition rate vs 11% for other roles. Immediate retention package assessment using Decision Engine (p > 27% threshold). Estimated replacement cost exposure: $105k per leaver."
  2. **Accent badge** — "Accelerate headcount to hit [proj.hc[0]] resource target by Dec 2026"
     Body: "Base forecast requires [proj.hc[0]] resources — currently at [hc]. Net new: [proj.hc[0]-hc+2] hires accounting for ~2 projected exits. Prioritise Software Engineer and Project Manager roles where GM% exceeds 13.5%."
  3. **Amber badge** — "Improve low-margin placements — [employees.filter(e=>e.gm<12).length] employees below 12% GM"
     Body: List their names. "Renegotiate daily rates at next contract renewal or redeploy to higher-value clients."
  4. **Green badge** — "Diversify client concentration — top client at [Math.round(clientData.sort((a,b)=>b.rev-a.rev)[0].rev/totalRev*100)]% of revenue"
     Body: "[topClient.hc] employees placed with [topClient.client] ([fmt(topClient.rev)] p.a.). [secondClient.client] and [thirdClient.client] under-penetrated. Target 2 new logos by Q4 [currentYear+1]."
- Footer bar (semi-transparent accent):
  "Decision Intelligence Dashboard  ·  Data as of [month year]  ·  For Director Use Only"

---

## Implementation plan

### 1. Add PptxGenJS CDN to `index.html`

Add before the closing `</body>` tag, **before** the existing script tags:
```html
<script src="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"></script>
```

### 2. Add UI section to `#panel-ai` in `index.html`

At the bottom of `<section id="panel-ai">`, after the existing ask-a-question card, add:

```html
<div class="bonus-divider">
  <span>🎁 Bonus</span>
</div>

<div class="card" id="deck-generator">
  <div class="ai-label"><i class="ti ti-presentation"></i> Slide Deck Generator — Director Briefing</div>
  <p class="section-intro">Upload your exported dashboard JSON to generate a 5-slide PowerPoint deck ready for directors.</p>

  <div class="deck-upload-zone" id="deck-drop-zone">
    <input type="file" id="deck-file-input" accept=".json" style="display:none" />
    <i class="ti ti-file-type-json" style="font-size:28px; color:var(--color-text-muted); display:block; margin-bottom:8px;"></i>
    <div style="font-size:14px; font-weight:500; margin-bottom:4px;">Drop your dashboard export JSON here</div>
    <div style="font-size:12px; color:var(--color-text-secondary); margin-bottom:12px;">or use the data already loaded in the dashboard</div>
    <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
      <button class="btn-outline" id="deck-browse-btn"><i class="ti ti-upload"></i> Browse JSON file</button>
      <button class="btn-primary" id="deck-use-current-btn"><i class="ti ti-database"></i> Use current data</button>
    </div>
  </div>

  <div id="deck-status" style="display:none"></div>
  <div id="deck-loaded-badge" style="display:none" class="status-bar status-success"></div>

  <div id="deck-generate-section" style="display:none; margin-top:1rem;">
    <div style="font-size:13px; color:var(--color-text-secondary); margin-bottom:10px;">Ready to generate. This builds all 5 slides in your browser — no server needed.</div>
    <button class="btn-primary" id="deck-generate-btn" style="width:100%; justify-content:center; padding:12px;">
      <i class="ti ti-sparkles"></i> Generate Director Slide Deck
    </button>
  </div>

  <div id="deck-result" style="display:none; margin-top:1rem; text-align:center;">
    <div class="status-bar status-success" style="justify-content:center; margin-bottom:12px;">
      <i class="ti ti-check"></i><span>5-slide deck generated successfully</span>
    </div>
    <button class="btn-primary" id="deck-download-btn" style="font-size:14px; padding:10px 24px;">
      <i class="ti ti-download"></i> Download director_briefing.pptx
    </button>
    <div style="font-size:11px; color:var(--color-text-secondary); margin-top:8px;">Charts are fully editable in PowerPoint</div>
  </div>
</div>
```

### 3. Add CSS to `src/styles.css`

```css
/* ── Bonus divider ── */
.bonus-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 1.5rem 0 1rem;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.bonus-divider::before,
.bonus-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

/* ── Deck upload zone ── */
.deck-upload-zone {
  border: 1.5px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
  padding: 2rem 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: background .15s;
  margin-bottom: 1rem;
}
.deck-upload-zone:hover,
.deck-upload-zone.drag { background: var(--color-bg-secondary); border-color: var(--color-blue); }
```

### 4. Add `src/slides.js` — the slide generation module

Create a new file `src/slides.js`. This is the core of the feature.

The file must export / define one async function: `generateDeck(employees)` that:
- Takes the array of employee objects
- Computes all aggregates (copy the formulas from the "Compute aggregates" section above)
- Uses the global `PptxGenJS` (loaded from CDN) to build all 5 slides exactly as specified
- Calls `pres.writeFile({ fileName: 'director_briefing.pptx' })` which triggers browser download
- Returns a Promise that resolves when the download is triggered

**Critical PptxGenJS rules to follow (violations corrupt the file):**
- NEVER use `#` prefix on hex color strings — `"1E2761"` not `"#1E2761"`
- NEVER encode opacity in 8-char hex — use `opacity` property on shadow objects separately
- NEVER reuse option objects across multiple `addShape`/`addText` calls — create a fresh object each time (especially shadow objects — PptxGenJS mutates them in-place converting to EMU)
- Use `bullet: true` in options array — never unicode `"•"` characters
- Use `breakLine: true` between array text items, not `\n` inside text arrays

**Coordinate system:** all positions in inches on a 10" × 5.625" canvas (LAYOUT_16x9).

Build the slides in this order: Cover → Portfolio Snapshot → Revenue Forecast → Attrition → Recommendations.

Reference the full slide specifications in this prompt for exact coordinates, font sizes, colors, and chart configurations.

### 5. Add event wiring to `src/dashboard.js`

Add a new section `// ── Slide Deck Generator ──` at the bottom of dashboard.js with:

```js
// ── Slide Deck Generator ─────────────────────────────────────────────────────

let deckEmployees = null;  // employees loaded for deck generation

function initDeckGenerator() {
  const dropZone    = document.getElementById('deck-drop-zone');
  const fileInput   = document.getElementById('deck-file-input');
  const browseBtn   = document.getElementById('deck-browse-btn');
  const currentBtn  = document.getElementById('deck-use-current-btn');
  const generateBtn = document.getElementById('deck-generate-btn');
  const downloadBtn = document.getElementById('deck-download-btn');

  // Browse button
  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  // Use current dashboard data
  currentBtn.addEventListener('click', () => {
    loadDeckData(DATA);  // DATA is the global from dashboard.js
  });

  // File input change
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) parseDeckJSON(fileInput.files[0]);
  });

  // Drag and drop
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag');
    if (e.dataTransfer.files[0]) parseDeckJSON(e.dataTransfer.files[0]);
  });

  // Generate button
  generateBtn.addEventListener('click', async () => {
    if (!deckEmployees) return;
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="spinner"></span> Building slides…';
    try {
      await generateDeck(deckEmployees);  // from slides.js
      document.getElementById('deck-result').style.display = 'block';
      document.getElementById('deck-generate-section').style.display = 'none';
    } catch(err) {
      showDeckStatus('Error: ' + err.message, 'error');
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = '<i class="ti ti-sparkles"></i> Generate Director Slide Deck';
    }
  });

  // Re-download button
  downloadBtn.addEventListener('click', async () => {
    if (deckEmployees) await generateDeck(deckEmployees);
  });
}

function parseDeckJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      // Accept either a raw array or { employees: [...] } or { data: [...] }
      const arr = Array.isArray(parsed) ? parsed
                : parsed.employees ? parsed.employees
                : parsed.data      ? parsed.data
                : null;
      if (!arr || arr.length === 0) throw new Error('No employee array found in JSON.');
      // Basic validation
      if (!arr[0].annualRev && !arr[0].annualRevenue) throw new Error('JSON does not match expected schema. Check it was exported from this dashboard.');
      // Normalise annualRevenue → annualRev if needed
      const normalised = arr.map(e => ({
        ...e,
        annualRev:    e.annualRev    ?? e.annualRevenue ?? 0,
        annualMargin: e.annualMargin ?? e.margin        ?? 0,
      }));
      loadDeckData(normalised);
    } catch(err) {
      showDeckStatus('Parse error: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function loadDeckData(employees) {
  deckEmployees = employees;
  const badge = document.getElementById('deck-loaded-badge');
  badge.style.display = 'flex';
  badge.innerHTML = `<i class="ti ti-check"></i><span>Loaded ${employees.length} employees — ready to generate</span>`;
  document.getElementById('deck-generate-section').style.display = 'block';
  document.getElementById('deck-result').style.display = 'none';
}

function showDeckStatus(msg, type) {
  const el = document.getElementById('deck-status');
  el.style.display = 'flex';
  el.className = 'status-bar status-' + type;
  el.innerHTML = `<i class="ti ti-${type === 'error' ? 'x' : 'check'}"></i><span>${msg}</span>`;
}

// Initialise when DOM is ready
initDeckGenerator();
```

### 6. Add `src/slides.js` to the script load order in `index.html`

In the `<head>` or just before `</body>`, load scripts in this order:
```html
<script src="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"></script>
<script src="src/utils.js"></script>   <!-- if it exists -->
<script src="src/config.js"></script>
<script src="src/data.js"></script>
<script src="src/charts.js"></script>
<script src="src/slides.js"></script>  <!-- NEW -->
<script src="src/dashboard.js"></script>
```

---

## Verification checklist

After implementing, test these scenarios:

- [ ] "Use current data" button loads the 12 demo employees and shows the green badge
- [ ] Clicking "Generate Director Slide Deck" shows the spinner then the download button
- [ ] A `.pptx` file downloads named `director_briefing.pptx`
- [ ] Opening in PowerPoint shows 5 slides with correct numbers matching the dashboard
- [ ] Uploading a valid JSON file (export `DATA` from the browser console as JSON first) works the same way
- [ ] Uploading an invalid file shows a clear error message
- [ ] The drag-and-drop zone accepts JSON files dropped onto it
- [ ] The re-download button on the result state triggers another download

---

## Reference: JSON export format from the dashboard

The dashboard's exported JSON (from the "Export as JSON" button) should be either:
```json
[
  { "name": "Aisha Rahman", "client": "FinTech Corp", "role": "Software Engineer",
    "annualRev": 156000, "annualMargin": 24000, "gm": 15.4, "months": 18,
    "salary": 9500, "visa": "EP", "loc": "Singapore", ... },
  ...
]
```
or wrapped:
```json
{ "employees": [...], "exportedAt": "2026-05-26", "version": "1.0" }
```

The parser handles both shapes. Normalise `annualRevenue` → `annualRev` if the export uses the long form.

---

## Files to create or modify

| File | Action |
|---|---|
| `index.html` | Add CDN script tag + UI section inside `#panel-ai` + `src/slides.js` to load order |
| `src/styles.css` | Add `.bonus-divider` and `.deck-upload-zone` styles |
| `src/slides.js` | **Create new** — `generateDeck(employees)` function with all 5 slides |
| `src/dashboard.js` | Add `initDeckGenerator()` + helper functions at the bottom |
