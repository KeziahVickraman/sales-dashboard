/**
 * data.js
 * ───────
 * Demo seed data (used when no Excel is uploaded) and the Excel parser
 * that maps your sangeeta_template.xlsx column headers to the internal
 * data model.
 *
 * Internal employee object shape:
 * {
 *   name, client, visa, role, loc, months,
 *   daily, monthly, salary, cpf, fees, ctc,
 *   gp, gm, annualRev, annualMargin,
 *   yearly: { 2023: {rev, margin}, 2024: {rev, margin}, 2025: {rev, margin} }
 * }
 */

const TREND_YEARS = [2023, 2024, 2025];
const TREND_REF_YEAR = 2025;
const TREND_YOY_GROWTH = 1.12;

// May–Dec 2026 columns from full_data. The values represent DAYS WORKED
// per month per employee; monthly revenue is derived as days × daily_rate.
// Aliases tolerate both 'Jun-26' / 'June-26', 'Sep-26' / 'Sept-26' etc.
const MONTHS_2026 = [
  { label: 'May', aliases: ['May-26', 'May 26', 'May 2026', 'May'] },
  { label: 'Jun', aliases: ['June-26', 'Jun-26', 'June 26', 'June', 'Jun'] },
  { label: 'Jul', aliases: ['July-26', 'Jul-26', 'July 26', 'July', 'Jul'] },
  { label: 'Aug', aliases: ['Aug-26', 'August-26', 'Aug 26', 'August', 'Aug'] },
  { label: 'Sep', aliases: ['Sept-26', 'Sep-26', 'September-26', 'September', 'Sep'] },
  { label: 'Oct', aliases: ['Oct-26', 'October-26', 'October', 'Oct'] },
  { label: 'Nov', aliases: ['Nov-26', 'November-26', 'November', 'Nov'] },
  { label: 'Dec', aliases: ['Dec-26', 'December-26', 'December', 'Dec'] },
];

/**
 * Synthesise per-year revenue & margin from tenure when explicit
 * year columns are not provided. An employee's contribution in a
 * year is scaled by how much of that year they were active (based
 * on months of tenure) and back-discounted by a YoY rate-growth
 * assumption so the trend looks realistic.
 */
function deriveYearly(emp) {
  const yearly = {};
  for (const year of TREND_YEARS) {
    const yearsBack = TREND_REF_YEAR - year;
    const factor = Math.max(0, Math.min(1, (emp.months - yearsBack * 12) / 12));
    const rev = Math.round((emp.annualRev || 0) / Math.pow(TREND_YOY_GROWTH, yearsBack) * factor);
    const margin = Math.round(rev * ((emp.gm || 0) / 100));
    yearly[year] = { rev, margin };
  }
  return yearly;
}

const DEMO_DATA_BASE = [
  { name: 'Aisha Rahman',     client: 'FinTech Corp', visa: 'EP',      role: 'Software Engineer', loc: 'Singapore', months: 18, daily: 650, monthly: 13000, salary: 9500,  cpf: 1200, fees: 300, ctc: 11000, gp: 2000, gm: 15.4, annualRev: 156000, annualMargin: 24000 },
  { name: 'Ben Lim',          client: 'MegaBank',     visa: 'Citizen', role: 'Business Analyst',  loc: 'Singapore', months: 36, daily: 480, monthly:  9600, salary: 7200,  cpf:  900, fees: 200, ctc:  8300, gp: 1300, gm: 13.5, annualRev: 115200, annualMargin: 15600 },
  { name: 'Chen Wei',         client: 'FinTech Corp', visa: 'PR',      role: 'Data Analyst',      loc: 'Singapore', months:  8, daily: 420, monthly:  8400, salary: 6500,  cpf:  800, fees: 150, ctc:  7450, gp:  950, gm: 11.3, annualRev: 100800, annualMargin: 11400 },
  { name: 'Diana Tan',        client: 'GlobalLog',    visa: 'EP',      role: 'Project Manager',   loc: 'KL',        months: 24, daily: 580, monthly: 11600, salary: 8800,  cpf:    0, fees: 400, ctc:  9200, gp: 2400, gm: 20.7, annualRev: 139200, annualMargin: 28800 },
  { name: 'Ethan Ng',         client: 'MegaBank',     visa: 'Citizen', role: 'Software Engineer', loc: 'Singapore', months: 42, daily: 700, monthly: 14000, salary: 10500, cpf: 1300, fees: 300, ctc: 12100, gp: 1900, gm: 13.6, annualRev: 168000, annualMargin: 22800 },
  { name: 'Fatima Al-Rashid', client: 'HealthCo',     visa: 'EP',      role: 'Business Analyst',  loc: 'Singapore', months:  6, daily: 460, monthly:  9200, salary: 7000,  cpf:  875, fees: 200, ctc:  8075, gp: 1125, gm: 12.2, annualRev: 110400, annualMargin: 13500 },
  { name: 'George Poh',       client: 'GlobalLog',    visa: 'PR',      role: 'Data Analyst',      loc: 'Singapore', months: 30, daily: 440, monthly:  8800, salary: 6800,  cpf:  850, fees: 150, ctc:  7800, gp: 1000, gm: 11.4, annualRev: 105600, annualMargin: 12000 },
  { name: 'Hannah Kwok',      client: 'HealthCo',     visa: 'Citizen', role: 'Project Manager',   loc: 'KL',        months: 15, daily: 520, monthly: 10400, salary: 7900,  cpf:    0, fees: 350, ctc:  8250, gp: 2150, gm: 20.7, annualRev: 124800, annualMargin: 25800 },
  { name: 'Ivan Soh',         client: 'TechStart',    visa: 'EP',      role: 'Software Engineer', loc: 'Singapore', months:  3, daily: 600, monthly: 12000, salary: 9000,  cpf: 1125, fees: 250, ctc: 10375, gp: 1625, gm: 13.5, annualRev: 144000, annualMargin: 19500 },
  { name: 'Julia Chong',      client: 'TechStart',    visa: 'Citizen', role: 'Business Analyst',  loc: 'Singapore', months: 55, daily: 500, monthly: 10000, salary: 7500,  cpf:  938, fees: 200, ctc:  8638, gp: 1362, gm: 13.6, annualRev: 120000, annualMargin: 16344 },
  { name: 'Kevin Raj',        client: 'MegaBank',     visa: 'EP',      role: 'Data Analyst',      loc: 'Singapore', months: 20, daily: 390, monthly:  7800, salary: 6000,  cpf:  750, fees: 150, ctc:  6900, gp:  900, gm: 11.5, annualRev:  93600, annualMargin: 10800 },
  { name: 'Lily Fong',        client: 'FinTech Corp', visa: 'PR',      role: 'Project Manager',   loc: 'Singapore', months: 48, daily: 560, monthly: 11200, salary: 8500,  cpf: 1063, fees: 350, ctc:  9913, gp: 1287, gm: 11.5, annualRev: 134400, annualMargin: 15444 },
];

// For demo data, approximate ~20 billable days/month with mild seasonal
// variation so the monthly run-rate chart looks plausible out of the box.
// Real uploaded data overrides this via the May-26..Dec-26 columns.
const DEMO_MONTHLY_PATTERN = [20, 21, 20, 22, 21, 22, 20, 19];

const DEMO_DATA = DEMO_DATA_BASE.map(e => ({
  ...e,
  yearly: deriveYearly(e),
  monthly2026: DEMO_MONTHLY_PATTERN.slice(),
}));

// ── Column name aliases for your Excel headers ──────────────────────────────
// Add any variant column names from your actual file here.
const COL_MAP = {
  name:         ['Employee Name', 'employee name', 'Name', 'name'],
  client:       ['Client', 'client', 'Client ', 'Client Name'],
  visa:         ['Visa Status', 'visa status', 'Visa', 'visa'],
  role:         ['Role/Job Category', 'Role/Job Category ', 'Role', 'Job Category', 'role'],
  loc:          ['Location', 'location'],
  months:       ['Months of Service', 'months of service', 'Months', 'months', 'Tenure (months)'],
  daily:        ['Daily rate', 'Daily Rate', 'daily rate', 'Daily'],
  monthly:      ['Monthly Rate', 'monthly rate', 'Monthly', 'monthly'],
  salary:       ['Salary', 'salary'],
  cpf:          ['CPF/Bonus', 'cpf/bonus', 'CPF', 'cpf'],
  fees:         ['Other Fees', 'other fees', 'Fees', 'fees'],
  ctc:          ['CTC', 'ctc'],
  gp:           ['Gross Profit', 'gross profit', 'GP', 'gp'],
  gm:           ['GM %', 'GM%', 'gm %', 'gm', 'Gross Margin %'],
  annualRev:    ['Annual Revenue', 'annual revenue', 'Annual Rev', 'Revenue'],
  annualMargin: ['Annual Margin', 'annual margin', 'Margin'],
  rev2023:      ['Annual Revenue 2023', 'Revenue 2023', '2023 Revenue', 'Rev 2023'],
  rev2024:      ['Annual Revenue 2024', 'Revenue 2024', '2024 Revenue', 'Rev 2024'],
  rev2025:      ['Annual Revenue 2025', 'Revenue 2025', '2025 Revenue', 'Rev 2025'],
  margin2023:   ['Annual Margin 2023', 'Margin 2023', '2023 Margin'],
  margin2024:   ['Annual Margin 2024', 'Margin 2024', '2024 Margin'],
  margin2025:   ['Annual Margin 2025', 'Margin 2025', '2025 Margin'],
};

/**
 * parseWorkbook(wb)
 * Reads SheetJS workbook and returns array of employee objects.
 * Tries "full_data" sheet first, falls back to first sheet.
 */
function parseWorkbook(wb) {
  const sheetName =
    wb.SheetNames.find(s => s.toLowerCase().replace(/\s/g, '_') === 'full_data') ||
    wb.SheetNames[0];

  const ws   = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

  // Header lookup is whitespace- and case-insensitive so trailing spaces
  // in the template ("Client ", "Annual Revenue ", etc.) don't silently
  // miss. The per-row normalised view is built once per row.
  const normKey = k => String(k).trim().toLowerCase();
  const out = [];

  for (const row of rows) {
    const norm = {};
    for (const k of Object.keys(row)) norm[normKey(k)] = row[k];

    const findVal = keys => {
      for (const k of keys) {
        const v = norm[normKey(k)];
        if (v !== null && v !== undefined) return v;
      }
      return null;
    };

    const name = findVal(COL_MAP.name);
    // Skip rows without a name or rows that are Excel formula artefacts
    if (!name || typeof name !== 'string' || name.startsWith('=') || name.trim() === '') continue;

    const gm        = parseFloat(findVal(COL_MAP.gm))        || 0;
    const annualRev = parseFloat(findVal(COL_MAP.annualRev)) || 0;
    const rawMargin = findVal(COL_MAP.annualMargin);
    const annualMargin = rawMargin !== null ? parseFloat(rawMargin) : annualRev * (gm / 100);

    const emp = {
      name:         String(name).trim(),
      client:       String(findVal(COL_MAP.client) ?? 'Unknown').trim(),
      visa:         String(findVal(COL_MAP.visa)   ?? 'Unknown').trim(),
      role:         String(findVal(COL_MAP.role)   ?? 'Unknown').trim(),
      loc:          String(findVal(COL_MAP.loc)    ?? 'Unknown').trim(),
      months:       parseFloat(findVal(COL_MAP.months))  || 0,
      daily:        parseFloat(findVal(COL_MAP.daily))   || 0,
      monthly:      parseFloat(findVal(COL_MAP.monthly)) || 0,
      salary:       parseFloat(findVal(COL_MAP.salary))  || 0,
      cpf:          parseFloat(findVal(COL_MAP.cpf))     || 0,
      fees:         parseFloat(findVal(COL_MAP.fees))    || 0,
      ctc:          parseFloat(findVal(COL_MAP.ctc))     || 0,
      gp:           parseFloat(findVal(COL_MAP.gp))      || 0,
      gm,
      annualRev,
      annualMargin,
    };

    // Derive per-year baseline from tenure, then overlay any real
    // per-year columns from the sheet on top.
    const yearly = deriveYearly(emp);
    for (const y of TREND_YEARS) {
      const realRev    = parseFloat(findVal(COL_MAP['rev' + y]));
      const realMargin = parseFloat(findVal(COL_MAP['margin' + y]));
      if (!isNaN(realRev))    yearly[y].rev    = realRev;
      if (!isNaN(realMargin)) yearly[y].margin = realMargin;
    }
    emp.yearly = yearly;

    // Days worked per month in 2026 (May–Dec); rev derived as days × daily_rate
    emp.monthly2026 = MONTHS_2026.map(m => {
      const v = parseFloat(findVal(m.aliases));
      return isNaN(v) ? 0 : v;
    });

    out.push(emp);
  }

  return out;
}

/**
 * parseAttritionAnalysis(wb)
 * Reads the workbook's attrition_analysis sheet and returns:
 *   {
 *     trend:        { 2023: {openingHC, newHires, left, attritionRate, retentionRate}, 2024: {...}, 2025: {...} },
 *     byRole:       [ { role,     left, stayed, total, attritionPct }, ... ],
 *     byLocation:   [ { location, left, stayed, total, attritionPct }, ... ],
 *     revenueImpact:{ 2023: { revenueLost, avgMonthsLeft }, 2024: {...}, 2025: {...} }
 *   }
 * Returns null if the sheet is missing or has no data populated.
 *
 * Tolerates row-position drift: locates each block by scanning for its
 * label in column A (case-insensitive). Falls back to manual computation
 * when formula cells have no cached value (e.g. template not yet opened
 * in Excel).
 */
function parseAttritionAnalysis(wb) {
  const target = 'attritionanalysis';
  const sheetName = wb.SheetNames.find(s =>
    s.toLowerCase().replace(/[\s_-]/g, '') === target
  );
  if (!sheetName) return null;

  const ws   = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (!rows.length) return null;

  const safeNum = v => (typeof v === 'number' && isFinite(v)) ? v : null;

  const findRow = (needle, startFrom = 0) => {
    const n = needle.toLowerCase();
    for (let i = startFrom; i < rows.length; i++) {
      const r = rows[i];
      if (r && typeof r[0] === 'string' && r[0].toLowerCase().includes(n)) return i;
    }
    return -1;
  };

  // ── Summary block: per-year attrition figures ─────────────────────────────
  const openingIdx   = findRow('opening headcount');
  const newHiresIdx  = findRow('new hires');
  const leftIdx      = findRow('left');
  const rateIdx      = findRow('attrition rate');
  const retentionIdx = findRow('retention rate');

  const trend = {};
  TREND_YEARS.forEach((y, i) => {
    const col       = i + 1; // year columns start at B (index 1)
    const opening   = (openingIdx   >= 0 ? safeNum(rows[openingIdx]?.[col])   : null) ?? 0;
    const newHires  = (newHiresIdx  >= 0 ? safeNum(rows[newHiresIdx]?.[col])  : null) ?? 0;
    const left      = (leftIdx      >= 0 ? safeNum(rows[leftIdx]?.[col])      : null) ?? 0;
    const rate      =  rateIdx      >= 0 ? safeNum(rows[rateIdx]?.[col])      : null;
    const retention =  retentionIdx >= 0 ? safeNum(rows[retentionIdx]?.[col]) : null;

    trend[y] = {
      openingHC:     opening,
      newHires,
      left,
      attritionRate: rate      !== null ? rate      : (opening > 0 ? left / opening      : 0),
      retentionRate: retention !== null ? retention : (opening > 0 ? 1 - left / opening  : 0),
    };
  });

  // ── Section scanner for "X by Y" tables (role, location) ──────────────────
  const scanByTable = (sectionLabel, keyName) => {
    const startIdx = findRow(sectionLabel);
    if (startIdx < 0) return [];
    const items = [];
    // Header row at startIdx+1, data starts at startIdx+2
    for (let i = startIdx + 2; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const label = r[0];
      if (typeof label !== 'string' || !label.trim()) continue;
      const lower = label.toLowerCase();
      // Stop at the next section header, the "Total" row, or unfilled placeholder rows
      if (label === 'Total' || lower.startsWith('attrition by') || lower.startsWith('revenue impact')) break;
      if (label.startsWith('<')) continue;

      const left   = safeNum(r[1]) ?? 0;
      const stayed = safeNum(r[2]) ?? 0;
      const total  = safeNum(r[3]) ?? (left + stayed);
      const pct    = safeNum(r[4]);
      items.push({
        [keyName]:    label.trim(),
        left, stayed, total,
        attritionPct: pct !== null ? pct : (total > 0 ? left / total : 0),
      });
    }
    return items;
  };

  const byRole     = scanByTable('attrition by role',     'role');
  const byLocation = scanByTable('attrition by location', 'location');

  // ── Revenue impact block ──────────────────────────────────────────────────
  const impactIdx  = findRow('revenue impact');
  const lostIdx    = impactIdx >= 0 ? findRow('annual revenue lost', impactIdx) : -1;
  const monthsIdx  = impactIdx >= 0 ? findRow('avg months',          impactIdx) : -1;

  const revenueImpact = {};
  TREND_YEARS.forEach((y, i) => {
    const col = i + 1;
    revenueImpact[y] = {
      revenueLost:   (lostIdx   >= 0 ? safeNum(rows[lostIdx]?.[col])   : null) ?? 0,
      avgMonthsLeft: (monthsIdx >= 0 ? safeNum(rows[monthsIdx]?.[col]) : null) ?? 0,
    };
  });

  // If literally nothing came through, signal "no real data" so the
  // dashboard can fall back to its tenure heuristic.
  const hasAnyTrend = Object.values(trend).some(t =>
    t.openingHC > 0 || t.left > 0 || t.attritionRate > 0
  );
  if (!hasAnyTrend && byRole.length === 0 && byLocation.length === 0) return null;

  return { trend, byRole, byLocation, revenueImpact };
}
