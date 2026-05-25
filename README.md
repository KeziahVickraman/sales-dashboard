# Sales Decision Intelligence Dashboard

A browser-based decision intelligence dashboard for a staffing/sales team. The core dashboard is vanilla HTML/CSS/JS and reads an Excel workbook. AI Insights are routed through a backend proxy so the Anthropic API key stays server-side.

---

## Project Structure

```text
sales-dashboard/
├── index.html          Main app shell and dashboard panels
├── api/
│   └── claude.js       Vercel serverless proxy for Anthropic API
├── src/
│   ├── styles.css      Styles, light/dark mode, dashboard layout
│   ├── config.js       Browser-safe AI config, no API key
│   ├── data.js         Demo data and Excel parser
│   ├── charts.js       Chart.js rendering functions
│   ├── dashboard.js    App state, panel rendering, AI calls
│   └── server.js       Local Express server and API proxy
├── package.json
└── README.md
```

---

## Quick Start

Install dependencies once:

```bash
npm install
```

Run without AI Insights:

```bash
python -m http.server 3000
```

Run with AI Insights locally:

```powershell
$env:ANTHROPIC_API_KEY="sk-ant-your-real-key-here"
node src/server.js
```

Then open:

```text
http://localhost:3000
```

Do not open `index.html` directly if you want AI Insights to work. The AI tab calls `/api/claude`, which is provided by the local server or Vercel.

---

## AI Insights Setup

1. Create an API key at `https://console.anthropic.com/`.
2. Do not put the key in `src/config.js`.
3. Store the key as an environment variable named:

```text
ANTHROPIC_API_KEY
```

Local PowerShell:

```powershell
$env:ANTHROPIC_API_KEY="sk-ant-your-real-key-here"
node src/server.js
```

Vercel:

1. Import the GitHub repo in Vercel.
2. Add `ANTHROPIC_API_KEY` in Project Settings -> Environment Variables.
3. Deploy.

The browser calls:

```js
fetch('/api/claude', ...)
```

Locally this routes to `src/server.js`. On Vercel this routes to `api/claude.js`.

---

## Loading Excel Data

1. Fill in `sangeeta_template.xlsx`, especially the `full_data` sheet.
2. Open the dashboard.
3. Click **Upload Excel**.
4. Drop or select your workbook.

The dashboard also reads `attrition_analysis` when present.

### Column Mapping

The parser auto-maps these column header variants from `full_data`:

| Field | Accepted headers |
|---|---|
| Employee name | `Employee Name`, `Name` |
| Client | `Client`, `Client ` |
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

To add more aliases, edit `COL_MAP` in `src/data.js`.

---

## Dashboard Sections

| Section | Tabs |
|---|---|
| Overview | Overview, Portfolio |
| Historical Trends | Historical Trend, Attrition Analysis |
| Future Predictions | Revenue Forecast, Attrition Prediction |
| BONUS | Decision Engine, AI Insights |

---

## Dependencies

Runtime/backend:

| Package | Purpose |
|---|---|
| Express | Local server and API proxy |

Frontend CDNs:

| Library | Purpose |
|---|---|
| Chart.js | Charts |
| SheetJS | Excel parsing |
| Tabler Icons | UI icons |

---

## Security Notes

- Never commit a real Anthropic API key.
- Keep `.env`, `.vercel/`, and `node_modules/` out of Git.
- Use Vercel environment variables or local shell environment variables for `ANTHROPIC_API_KEY`.
- The API key should only be read from `process.env.ANTHROPIC_API_KEY` on the backend.
