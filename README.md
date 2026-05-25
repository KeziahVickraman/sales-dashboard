# Sales Decision Intelligence Dashboard

A fully self-contained, browser-based decision intelligence dashboard for your staffing/sales team. No build step required — open `index.html` directly in a browser or serve with any static file server.

---

## Project structure

```
sales-dashboard/
├── index.html          ← Main app shell & all HTML panels
├── src/
│   ├── styles.css      ← All styles (light + dark mode)
│   ├── config.js       ← API key config (edit this)
│   ├── data.js         ← Demo data + Excel parser
│   ├── charts.js       ← All Chart.js rendering functions
│   └── dashboard.js    ← App state, panel logic, AI calls
└── README.md
```

---

## Quick start

### Option 1 — Open directly
Just double-click `index.html`. Works in any modern browser. No server needed for the core dashboard.

> ⚠️ The AI Insights tab makes API calls to `api.anthropic.com`. Browsers may block this without a server due to CORS — use Option 2 if the AI tab shows errors.

### Option 2 — Local server (recommended)

```bash
# Python (built-in)
cd sales-dashboard
python3 -m http.server 3000
# → open http://localhost:3000

# Node.js (npx, no install)
npx serve sales-dashboard
# → open http://localhost:3000

# VS Code: install "Live Server" extension, right-click index.html → "Open with Live Server"
```

---

## Setup: AI Insights tab

1. Get your API key from [console.anthropic.com](https://console.anthropic.com/)
2. Open `src/config.js`
3. Replace `YOUR_API_KEY_HERE` with your key:
   ```js
   const CONFIG = {
     ANTHROPIC_API_KEY: 'sk-ant-...your-key-here...',
     ...
   };
   ```

> ⚠️ **Never commit your API key to a public repo.**
> For production, move the API call to a backend proxy (Node/Python/etc.) so the key stays server-side.

---

## Loading your Excel data

1. Fill in your `sangeeta_template.xlsx` — the `full_data` sheet with real employee rows
2. Click **Upload Excel** in the top-right of the dashboard
3. Drop or select your file — the dashboard reloads instantly with your data

### Column mapping

The parser auto-maps these column header variants from `full_data`:

| Field | Accepted headers |
|---|---|
| Employee name | `Employee Name`, `Name` |
| Client | `Client`, `Client ` (with trailing space) |
| Visa status | `Visa Status`, `Visa` |
| Role | `Role/Job Category`, `Role/Job Category `, `Job Category` |
| Location | `Location` |
| Months | `Months of Service`, `Months`, `Tenure (months)` |
| Daily rate | `Daily rate`, `Daily Rate` |
| Monthly rate | `Monthly Rate`, `Monthly` |
| Salary | `Salary` |
| CPF/Bonus | `CPF/Bonus`, `CPF` |
| Other fees | `Other Fees`, `Fees` |
| CTC | `CTC` |
| Gross Profit | `Gross Profit`, `GP` |
| GM% | `GM %`, `GM%`, `Gross Margin %` |
| Annual Revenue | `Annual Revenue`, `Annual Rev` |
| Annual Margin | `Annual Margin`, `Margin` |

To add more aliases, edit the `COL_MAP` object in `src/data.js`.

---

## Tabs

| Tab | What it shows |
|---|---|
| **Overview** | KPIs, revenue by role, monthly run-rate, GM% distribution, visa & location breakdowns |
| **ML Forecast** | 3-scenario revenue forecast (base/bull/bear) with confidence bands, headcount projection, revenue per resource trend, projection table |
| **Attrition** | Attrition rate, revenue at risk, replacement cost, trend chart, attrition by role, per-employee risk scores, ML feature importance |
| **Decision Engine** | Interactive retention package decision model — mirrors the Prof Roh expected-value framework with live sliders and cost curves |
| **Portfolio** | Filterable placement register with bubble chart (revenue vs GM% vs tenure) |
| **AI Insights** | One-click Claude analysis (portfolio summary, attrition, forecast rationale, top 3 actions) + free-text Q&A against your data |

---

## Extending the dashboard

### Add a new chart
1. Add a `<canvas id="c-myChart">` in `index.html` inside a `.card`
2. Write a `renderMyChart(data)` function in `src/charts.js`
3. Call it from the relevant panel render function in `src/dashboard.js`

### Add a new tab
1. Add a `<button class="tab">` in the nav in `index.html`
2. Add a `<section id="panel-myTab" class="panel">` in `main`
3. Add the `id` case to `showPanel()` in `dashboard.js`

### Connect to a real backend / database
Replace the `DATA` array population in `dashboard.js` with a `fetch()` call to your API endpoint. The rest of the dashboard is data-agnostic.

---

## Dependencies (all CDN, no npm install)

| Library | Version | Purpose |
|---|---|---|
| Chart.js | 4.4.1 | All charts |
| SheetJS (xlsx) | 0.18.5 | Excel file parsing |
| Tabler Icons | 2.44.0 | UI icons |

---

## Browser support

Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
