# Sales Decision Intelligence Dashboard — Claude Code Context

## What this project is

A single-page, zero-build browser dashboard for a staffing/consultancy sales team. It reads an
Excel workbook (`sangeeta_template.xlsx`) and renders five panels: Overview, ML Forecast,
Attrition Intelligence, Decision Engine, and Portfolio View. An AI Insights tab calls the
Anthropic API to generate analysis against the live data. No framework, no bundler — just
vanilla JS split across four files loaded via `<script>` tags.

## File map

```
index.html          App shell. All HTML panels and nav. Loads the four src/ scripts in order.
src/config.js       Single CONFIG object. ANTHROPIC_API_KEY, MODEL, MAX_TOKENS.
src/data.js         DEMO_DATA array (12 seed employees) + parseWorkbook(wb) Excel parser.
                    COL_MAP handles all column header aliases from the real template.
src/charts.js       Pure rendering functions — one per chart. Each calls mkChart(id, cfg)
                    which destroy-and-recreates a Chart.js instance safely.
                    Also defines PALETTE and a local fmt() helper.
src/dashboard.js    App state (DATA, isLiveData, currentScenario), all panel render
                    functions, file upload handler, AI API calls, and the boot IIFE.
```

## Data model — employee object shape

Every row in DATA conforms to:
```js
{
  name, client, visa, role, loc,          // strings
  months,                                  // number — tenure in months
  daily, monthly, salary, cpf, fees, ctc, // numbers — financials
  gp, gm,                                 // gross profit ($), gross margin (%)
  annualRev, annualMargin                  // numbers
}
```

## Key functions to know

| Function | File | What it does |
|---|---|---|
| `parseWorkbook(wb)` | data.js | SheetJS → employee array. Tolerant column alias matching via COL_MAP. |
| `handleFile(file)` | dashboard.js | FileReader → XLSX.read → parseWorkbook → refreshAll |
| `refreshAll()` | dashboard.js | Re-renders all 5 panels after new data loads |
| `initOverview()` | dashboard.js | Computes KPIs, calls 5 chart renders |
| `renderForecast()` | dashboard.js | Scenario math (base/bull/bear), calls 3 chart renders + table |
| `renderAttrition()` | dashboard.js | Attrition rate estimate, risk scoring, calls 3 chart renders |
| `updateDecision()` | dashboard.js | Expected-value retention decision model (slider-driven, live) |
| `renderPortfolio()` | dashboard.js | Filter + sort DATA, calls bubble chart + table |
| `buildDataSummary()` | dashboard.js | Produces plain-text portfolio digest for Claude API prompts |
| `callClaude(content)` | dashboard.js | POST to /v1/messages, returns text string |
| `mkChart(id, cfg)` | charts.js | Safe Chart.js destroy-then-create |
| `fmt(n)` | charts.js + dashboard.js | Compact currency: $1.2M / $30k / $500 |
| `showPanel(id, btn)` | dashboard.js | Tab switcher with lazy render on first open |

## Attrition heuristic (current — placeholder ML)

Risk score = 38 + tenure_score + gm_score (capped at 95)
- tenure_score: <6mo → 30, <12mo → 20, >42mo → 18, else 8
- gm_score: <12% → 18, >18% → 5, else 10

This is a rule-based proxy. The "ML Feature Importance" chart is hardcoded.
**This is the #1 thing to replace with a real model.**

## Forecast model (current — simple compound growth)

hist = [2025Rev × 0.68, × 0.82, × 1.0]   ← synthetic 2023/2024 from 2025 base
proj[0] = hist[2] × (1 + growth[0])        ← compounds year-on-year
proj[1] = proj[0] × (1 + growth[1])
proj[2] = proj[1] × (1 + growth[2])

Scenarios are fixed multiplier tables in SCENARIOS constant.
**There is no actual ML model — just growth rate assumptions.**

## Decision Engine formula

Offer package iff:  p  >  C_package / (C_replace × lift)  =  p*

Where:
- p        = estimated attrition probability (slider)
- C_replace = cost to replace the employee (slider)
- C_package = retention package cost (slider)
- lift      = percentage-point reduction in attrition probability if package offered (slider)

Cost curves:
- Do nothing:    E[cost] = p × C_replace
- Offer package: E[cost] = C_package + (p − lift×p) × C_replace

## Known issues and performance gaps (see REVIEW.md for full list)

1. `fmt()` is defined in both charts.js and dashboard.js — duplication, can cause drift
2. `refreshAll()` re-renders ALL panels on data load, even hidden ones — wasted work
3. Attrition rate heuristic (months < 8 || months > 42) is arbitrary — not derived from data
4. `buildDataSummary()` does 7 separate DATA.reduce/filter passes — should be one loop
5. Filter dropdowns accumulate duplicates if resetFilters() called multiple times
6. No debounce on decision engine sliders — re-renders chart on every pixel drag
7. Monthly run-rate chart uses synthetic linear growth, not real month columns from Excel
8. `callClaude()` has no timeout — hangs forever if API doesn't respond
9. Projection table GM% row is hardcoded '13.7%' / '14.0%' regardless of actual data
10. CORS will block AI tab when opened as file:// — needs a local server

## How to run locally

```bash
cd sales-dashboard
python3 -m http.server 3000
# open http://localhost:3000
```

Add your Anthropic API key to `src/config.js` to enable the AI Insights tab.

## Extension points

- Replace the attrition heuristic with a real logistic regression or XGBoost model
  (train in Python, export coefficients, apply in JS)
- Pull `May-26` through `Dec-26` monthly columns from `full_data` for real run-rate chart
- Add a backend proxy (Node/Python) to keep the API key off the client
- Add `trend_analysis` and `attrition_analysis` sheet parsing to pre-populate historic data
- Wire scenario growth rates to actual historic YoY from `trend_analysis` sheet
