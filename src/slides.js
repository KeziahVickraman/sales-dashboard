/**
 * slides.js
 * Builds the Director Briefing PowerPoint deck in-browser with PptxGenJS.
 */

async function generateDeck(employees) {
  if (!Array.isArray(employees) || employees.length === 0) {
    throw new Error('No employees available for deck generation.');
  }
  const PptxCtor = window.PptxGenJS || window.pptxgenjs || window.pptxgen;
  if (!PptxCtor) {
    throw new Error('PptxGenJS is not loaded.');
  }

  const cleanEmployees = employees.map(e => ({
    ...e,
    name: e.name || 'Unknown',
    client: e.client || 'Unknown',
    role: e.role || 'Unknown',
    gm: Number(e.gm) || 0,
    annualRev: Number(e.annualRev ?? e.annualRevenue) || 0,
    annualMargin: Number(e.annualMargin ?? e.margin) || 0,
    months: Number(e.months) || 0,
    salary: Number(e.salary) || 0,
  }));

  const m = buildDeckMetrics(cleanEmployees);
  const pptx = new PptxCtor();
  pptx.defineLayout({ name: 'LAYOUT_16X9', width: 10, height: 5.625 });
  pptx.layout = 'LAYOUT_16X9';
  pptx.author = 'Sales Decision Intelligence Dashboard';
  pptx.company = 'UNISON GROUP';
  pptx.subject = 'Director briefing';
  pptx.title = 'Sales Portfolio Performance & Strategic Outlook';
  pptx.lang = 'en-US';
  pptx.theme = {
    headFontFace: 'Aptos Display',
    bodyFontFace: 'Aptos',
    lang: 'en-US',
  };

  addCoverSlide(pptx, m);
  addPortfolioSlide(pptx, m);
  addForecastSlide(pptx, m);
  addAttritionSlide(pptx, m);
  addRecommendationsSlide(pptx, m);

  await pptx.writeFile({ fileName: 'director_briefing.pptx' });
}

const DECK = {
  navy: '1E2761',
  ice: 'CADCFC',
  white: 'FFFFFF',
  slate: '64748B',
  light: 'F1F5FB',
  green: '1D9E75',
  red: 'E24B4A',
  amber: 'BA7517',
  accent: '378ADD',
};

function buildDeckMetrics(employees) {
  const totalRev = employees.reduce((s, e) => s + e.annualRev, 0);
  const totalMargin = employees.reduce((s, e) => s + e.annualMargin, 0);
  const avgGM = totalRev ? (totalMargin / totalRev * 100).toFixed(1) : '0.0';
  const hc = employees.length;
  const rpr = hc ? Math.round(totalRev / hc) : 0;
  const attrRate = hc ? Math.round(employees.filter(e => e.months < 8 || e.months > 42).length / hc * 100) : 0;
  const avgSalary = hc ? Math.round(employees.reduce((s, e) => s + e.salary, 0) / hc) : 0;
  const roles = [...new Set(employees.map(e => e.role))].sort();
  const roleData = roles.map(role => {
    const emps = employees.filter(e => e.role === role);
    return {
      role,
      hc: emps.length,
      rev: emps.reduce((s, e) => s + e.annualRev, 0),
      avgMonths: emps.reduce((s, e) => s + e.months, 0) / emps.length,
    };
  });
  const clients = [...new Set(employees.map(e => e.client))].sort();
  const clientData = clients.map(client => {
    const emps = employees.filter(e => e.client === client);
    return {
      client,
      hc: emps.length,
      rev: emps.reduce((s, e) => s + e.annualRev, 0),
    };
  });
  const proj = {
    rev: [Math.round(totalRev * 1.18), Math.round(totalRev * 1.18 * 1.15), Math.round(totalRev * 1.18 * 1.15 * 1.12)],
    hc: [Math.round(hc * 1.20), Math.round(hc * 1.20 * 1.12), Math.round(hc * 1.20 * 1.12 * 1.10)],
  };
  const cagr = totalRev ? ((Math.pow(proj.rev[2] / totalRev, 1 / 3) - 1) * 100).toFixed(1) : '0.0';
  const hist = {
    rev: [Math.round(totalRev / 1.12 / 1.12), Math.round(totalRev / 1.12), totalRev],
    hc: [Math.round(hc * 0.72), Math.round(hc * 0.85), hc],
  };
  const revAtRisk = Math.round(totalRev * (attrRate / 100));
  const replCost = Math.round(avgSalary * 0.5 * hc * attrRate / 100);
  const today = new Date();
  const monthYear = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const currentYear = today.getFullYear();
  const topClients = [...clientData].sort((a, b) => b.rev - a.rev);

  return {
    employees,
    totalRev,
    totalMargin,
    avgGM,
    hc,
    rpr,
    attrRate,
    avgSalary,
    roleData,
    clientData,
    clientCount: clients.length,
    proj,
    cagr,
    hist,
    revAtRisk,
    replCost,
    monthYear,
    currentYear,
    topClients,
  };
}

function fmtDeck(n) {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'k';
  return '$' + Math.round(n);
}

function chartTypes(pptx) {
  return pptx.ChartType || pptx.charts || { bar: 'bar', line: 'line' };
}

function shapeTypes(pptx) {
  return pptx.ShapeType || { rect: 'rect', roundRect: 'roundRect', ellipse: 'ellipse' };
}

function shadow() {
  return { type: 'outer', blur: 8, offset: 2, angle: 135, color: '000000', opacity: 0.07 };
}

function transparentFill(color, transparency) {
  return { color, transparency };
}

function addCoverSlide(pptx, m) {
  const s = pptx.addSlide();
  const shp = shapeTypes(pptx);
  s.background = { color: DECK.navy };
  s.addShape(shp.rect, { x: 7.25, y: 0.25, w: 1.95, h: 0.34, fill: transparentFill(DECK.accent, 35), line: { transparency: 100 }, rotate: 0 });
  s.addShape(shp.rect, { x: 8.10, y: 0.70, w: 1.45, h: 0.26, fill: transparentFill(DECK.ice, 60), line: { transparency: 100 }, rotate: 0 });
  s.addText('DIRECTOR BRIEFING  ·  FY 2025 - 2028', { x: 0.62, y: 0.72, w: 5.8, h: 0.2, fontSize: 9, color: DECK.ice, charSpace: 4, margin: 0 });
  s.addText('Sales Portfolio\nPerformance &\nStrategic Outlook', { x: 0.62, y: 1.28, w: 5.9, h: 2.0, fontSize: 40, bold: true, color: DECK.white, breakLine: false, fit: 'shrink', margin: 0.02 });
  s.addText('Headcount · Revenue · Attrition · 3-Year Forecast', { x: 0.66, y: 3.42, w: 4.7, h: 0.26, fontSize: 13, color: DECK.ice, margin: 0 });
  [
    [m.hc, 'HEADCOUNT'],
    [fmtDeck(m.totalRev), 'ANNUAL REV'],
    [m.avgGM + '%', 'AVG GM%'],
    [m.attrRate + '%', 'ATTRITION'],
  ].forEach((item, i) => {
    const x = 0.62 + i * 2.18;
    s.addShape(shp.roundRect, { x, y: 4.35, w: 1.88, h: 0.72, rectRadius: 0.08, fill: transparentFill(DECK.accent, 35), line: { transparency: 100 } });
    s.addText(String(item[0]), { x: x + 0.16, y: 4.48, w: 1.56, h: 0.22, fontSize: 18, bold: true, color: DECK.white, margin: 0 });
    s.addText(item[1], { x: x + 0.16, y: 4.78, w: 1.56, h: 0.12, fontSize: 7.5, color: DECK.ice, charSpace: 2, margin: 0 });
  });
  s.addText('As of ' + m.monthYear, { x: 0.62, y: 5.28, w: 2.4, h: 0.16, fontSize: 9, color: DECK.slate, margin: 0 });
}

function addPortfolioSlide(pptx, m) {
  const s = pptx.addSlide();
  const shp = shapeTypes(pptx);
  const ct = chartTypes(pptx);
  s.background = { color: DECK.white };
  s.addShape(shp.rect, { x: 0, y: 0, w: 3.4, h: 5.625, fill: { color: DECK.navy }, line: { transparency: 100 } });
  s.addText('02', { x: 0.42, y: 0.46, w: 0.9, h: 0.36, fontSize: 28, bold: true, color: DECK.accent, margin: 0 });
  s.addText('PORTFOLIO\nSNAPSHOT', { x: 0.46, y: 1.02, w: 2.3, h: 0.62, fontSize: 13, bold: true, color: DECK.white, charSpace: 2, margin: 0.02 });
  [
    ['Total Headcount', m.hc],
    ['Annual Revenue', fmtDeck(m.totalRev)],
    ['Annual Margin', fmtDeck(m.totalMargin)],
    ['Avg Gross Margin', m.avgGM + '%'],
    ['Revenue per Resource', fmtDeck(m.rpr)],
  ].forEach((row, i) => {
    const y = 2.0 + i * 0.58;
    s.addShape(shp.roundRect, { x: 0.42, y, w: 2.44, h: 0.42, rectRadius: 0.06, fill: transparentFill(DECK.accent, 55), line: { transparency: 100 } });
    s.addText(row[0], { x: 0.58, y: y + 0.08, w: 1.34, h: 0.12, fontSize: 7.5, color: DECK.ice, margin: 0 });
    s.addText(String(row[1]), { x: 1.85, y: y + 0.07, w: 0.86, h: 0.16, fontSize: 11, bold: true, color: DECK.white, align: 'right', margin: 0 });
  });
  s.addText('Revenue by Role Category', { x: 3.85, y: 0.48, w: 3.7, h: 0.28, fontSize: 17, bold: true, color: DECK.navy, margin: 0 });
  s.addText(`FY ${m.currentYear} actuals · ${m.hc} active placements across ${m.clientCount} clients`, { x: 3.85, y: 0.83, w: 5.0, h: 0.18, fontSize: 10, color: DECK.slate, margin: 0 });
  s.addChart(ct.bar || ct.BAR, [{ name: 'Annual Revenue', labels: m.roleData.map(r => r.role), values: m.roleData.map(r => r.rev) }], {
    x: 3.85,
    y: 1.2,
    w: 5.5,
    h: 2.0,
    barDir: 'bar',
    showLegend: false,
    showValue: true,
    dataLabelPosition: 'outEnd',
    dataLabelFormatCode: '"$"#,##0',
    catAxisLabelFontFace: 'Aptos',
    catAxisLabelFontSize: 8,
    valAxisLabelFontSize: 8,
    valAxisNumericFormat: '"$"#,##0',
    showCatName: false,
    showValAxis: true,
    showCatAxis: true,
    chartColors: [DECK.accent, DECK.green, DECK.amber, DECK.navy],
  });
  const rows = [
    [
      { text: 'Client', options: { bold: true, color: DECK.white, fill: { color: DECK.navy } } },
      { text: 'HC', options: { bold: true, color: DECK.white, fill: { color: DECK.navy }, align: 'right' } },
      { text: 'Annual Revenue', options: { bold: true, color: DECK.white, fill: { color: DECK.navy }, align: 'right' } },
    ],
    ...m.clientData.map(c => [
      { text: c.client, options: { color: DECK.navy } },
      { text: String(c.hc), options: { color: DECK.slate, align: 'right' } },
      { text: fmtDeck(c.rev), options: { color: DECK.slate, align: 'right' } },
    ]),
  ];
  s.addTable(rows, { x: 3.85, y: 3.52, w: 5.5, h: 1.55, fontSize: 8, margin: 0.06, border: { type: 'solid', color: 'D8E0EC', pt: 0.5 }, fill: { color: DECK.white }, colW: [3.0, 0.7, 1.8] });
}

function addForecastSlide(pptx, m) {
  const s = pptx.addSlide();
  const shp = shapeTypes(pptx);
  const ct = chartTypes(pptx);
  s.background = { color: DECK.light };
  s.addShape(shp.rect, { x: 0, y: 0, w: 10, h: 1.05, fill: { color: DECK.navy }, line: { transparency: 100 } });
  s.addText('03', { x: 0.42, y: 0.32, w: 0.55, h: 0.24, fontSize: 22, bold: true, color: DECK.accent, margin: 0 });
  s.addText('REVENUE TREND & 3-YEAR FORECAST', { x: 1.06, y: 0.39, w: 4.6, h: 0.16, fontSize: 13, bold: true, color: DECK.white, charSpace: 2, margin: 0 });
  s.addText('Base case · 18% / 15% / 12% YoY growth', { x: 6.45, y: 0.43, w: 3.05, h: 0.14, fontSize: 8, color: DECK.ice, align: 'right', margin: 0 });
  const years = ['2023', '2024', '2025', '2026', '2027', '2028'];
  s.addChart([
    { type: ct.bar || ct.BAR, data: [{ name: 'Historic', labels: years, values: [m.hist.rev[0], m.hist.rev[1], m.hist.rev[2], null, null, null] }] },
    { type: ct.line || ct.LINE, data: [{ name: 'Projected', labels: years, values: [null, null, m.hist.rev[2], m.proj.rev[0], m.proj.rev[1], m.proj.rev[2]] }] },
  ], {
    x: 0.55,
    y: 1.35,
    w: 5.55,
    h: 3.05,
    showLegend: true,
    legendPos: 'b',
    showValue: true,
    lineSize: 2.5,
    valAxisNumericFormat: '"$"#,##0',
    catAxisLabelFontSize: 8,
    valAxisLabelFontSize: 8,
    chartColors: [DECK.accent, DECK.green],
  });
  s.addText('Projected Targets', { x: 6.55, y: 1.35, w: 2.2, h: 0.22, fontSize: 15, bold: true, color: DECK.navy, margin: 0 });
  [
    ['2026', fmtDeck(m.proj.rev[0]), 'HC: ' + m.proj.hc[0], 'GM: 14.0%', DECK.accent],
    ['2027', fmtDeck(m.proj.rev[1]), 'HC: ' + m.proj.hc[1], 'GM: 14.0%', DECK.green],
    ['2028', fmtDeck(m.proj.rev[2]), 'HC: ' + m.proj.hc[2], 'GM: 14.0%', DECK.amber],
  ].forEach((card, i) => {
    const y = 1.78 + i * 0.78;
    s.addShape(shp.roundRect, { x: 6.55, y, w: 2.9, h: 0.6, rectRadius: 0.05, fill: { color: DECK.white }, line: { transparency: 100 }, shadow: shadow() });
    s.addShape(shp.rect, { x: 6.55, y, w: 0.08, h: 0.6, fill: { color: card[4] }, line: { transparency: 100 } });
    s.addText(card[0], { x: 6.78, y: y + 0.12, w: 0.52, h: 0.14, fontSize: 9, bold: true, color: DECK.slate, margin: 0 });
    s.addText(card[1], { x: 7.35, y: y + 0.09, w: 0.95, h: 0.18, fontSize: 13, bold: true, color: DECK.navy, margin: 0 });
    s.addText(`${card[2]}   ${card[3]}`, { x: 8.35, y: y + 0.13, w: 0.86, h: 0.12, fontSize: 7.5, color: DECK.slate, margin: 0 });
  });
  s.addShape(shp.rect, { x: 0, y: 4.76, w: 10, h: 0.62, fill: { color: DECK.navy }, line: { transparency: 100 } });
  s.addText(`3-Year CAGR  ->  +${m.cagr}%`, { x: 0.55, y: 4.95, w: 2.35, h: 0.18, fontSize: 13, bold: true, color: DECK.white, margin: 0 });
  s.addText(`Revenue per resource grows from ${fmtDeck(m.rpr)} to ${fmtDeck(m.proj.rev[2] / m.proj.hc[2])}`, { x: 3.0, y: 4.98, w: 4.4, h: 0.15, fontSize: 9.5, color: DECK.ice, margin: 0 });
}

function addAttritionSlide(pptx, m) {
  const s = pptx.addSlide();
  const shp = shapeTypes(pptx);
  const ct = chartTypes(pptx);
  s.background = { color: DECK.white };
  s.addShape(shp.rect, { x: 0, y: 0, w: 10, h: 1.05, fill: { color: DECK.navy }, line: { transparency: 100 } });
  s.addText('04', { x: 0.42, y: 0.32, w: 0.55, h: 0.24, fontSize: 22, bold: true, color: DECK.red, margin: 0 });
  s.addText('ATTRITION INTELLIGENCE', { x: 1.06, y: 0.39, w: 3.5, h: 0.16, fontSize: 13, bold: true, color: DECK.white, charSpace: 2, margin: 0 });
  s.addText('Risk · Cost · Retention Decisions', { x: 6.45, y: 0.43, w: 3.05, h: 0.14, fontSize: 8, color: DECK.ice, align: 'right', margin: 0 });
  s.addChart(ct.line || ct.LINE, [
    { name: 'Attrition %', labels: ['2023', '2024', '2025'], values: [11, 20, m.attrRate] },
    { name: 'Retention %', labels: ['2023', '2024', '2025'], values: [89, 80, 100 - m.attrRate] },
  ], {
    x: 0.55,
    y: 1.42,
    w: 4.2,
    h: 2.35,
    showLegend: true,
    legendPos: 'b',
    showValue: true,
    lineSize: 2.5,
    valAxisMinVal: 0,
    valAxisMaxVal: 100,
    valAxisLabelFontSize: 8,
    catAxisLabelFontSize: 8,
    dataLabelFormatCode: '0"%"',
    chartColors: [DECK.red, DECK.green],
  });
  const roleRates = m.roleData.map(r => {
    if (r.avgMonths < 8) return 22;
    if (r.avgMonths < 12) return 18;
    if (r.avgMonths > 42) return 10;
    return 14;
  });
  s.addChart(ct.bar || ct.BAR, [{ name: 'Attrition Rate', labels: m.roleData.map(r => r.role), values: roleRates }], {
    x: 5.15,
    y: 1.42,
    w: 4.25,
    h: 2.35,
    barDir: 'bar',
    showLegend: false,
    showValue: true,
    valAxisMinVal: 0,
    valAxisMaxVal: 30,
    dataLabelFormatCode: '0"%"',
    catAxisLabelFontSize: 8,
    valAxisLabelFontSize: 8,
    chartColors: roleRates.map(v => v > 15 ? DECK.red : DECK.amber),
  });
  [
    ['Revenue at Risk', fmtDeck(m.revAtRisk), '17% attrition × total rev', DECK.red],
    ['Est. Replacement Cost', fmtDeck(m.replCost), '0.5× avg salary per leaver', DECK.amber],
    ['Break-Even Offer p*', '~27%', 'C_pkg=$8k / (C_repl×lift 40%)', DECK.accent],
  ].forEach((card, i) => {
    const x = 0.55 + i * 3.12;
    s.addShape(shp.roundRect, { x, y: 4.12, w: 2.76, h: 0.82, rectRadius: 0.06, fill: { color: DECK.navy }, line: { transparency: 100 } });
    s.addShape(shp.rect, { x, y: 4.12, w: 2.76, h: 0.06, fill: { color: card[3] }, line: { transparency: 100 } });
    s.addText(card[1], { x: x + 0.18, y: 4.31, w: 1.45, h: 0.20, fontSize: 16, bold: true, color: card[3], margin: 0 });
    s.addText(card[0], { x: x + 0.18, y: 4.56, w: 2.2, h: 0.14, fontSize: 8.5, bold: true, color: DECK.white, margin: 0 });
    s.addText(card[2], { x: x + 0.18, y: 4.75, w: 2.2, h: 0.12, fontSize: 6.8, color: DECK.ice, margin: 0 });
  });
}

function addRecommendationsSlide(pptx, m) {
  const s = pptx.addSlide();
  const shp = shapeTypes(pptx);
  s.background = { color: DECK.navy };
  s.addShape(shp.rect, { x: 7.0, y: 0.28, w: 2.55, h: 0.34, fill: transparentFill(DECK.accent, 48), line: { transparency: 100 } });
  s.addText('05', { x: 0.54, y: 0.45, w: 0.55, h: 0.24, fontSize: 22, bold: true, color: DECK.accent, margin: 0 });
  s.addText('STRATEGIC RECOMMENDATIONS', { x: 1.17, y: 0.52, w: 3.5, h: 0.14, fontSize: 12, bold: true, color: DECK.ice, charSpace: 3, margin: 0 });
  s.addText('Priority actions for the next 90 days', { x: 1.17, y: 0.82, w: 2.8, h: 0.16, fontSize: 11, color: DECK.ice, margin: 0 });
  const lowMargin = m.employees.filter(e => e.gm < 12);
  const topClient = m.topClients[0] || { client: 'N/A', hc: 0, rev: 0 };
  const secondClient = m.topClients[1] || topClient;
  const thirdClient = m.topClients[2] || secondClient;
  const recs = [
    {
      color: DECK.red,
      title: 'Defend Software Engineers - highest attrition risk',
      body: '22% attrition rate vs 11% for other roles. Immediate retention package assessment using Decision Engine (p > 27% threshold). Estimated replacement cost exposure: $105k per leaver.',
    },
    {
      color: DECK.accent,
      title: `Accelerate headcount to hit ${m.proj.hc[0]} resource target by Dec 2026`,
      body: `Base forecast requires ${m.proj.hc[0]} resources - currently at ${m.hc}. Net new: ${m.proj.hc[0] - m.hc + 2} hires accounting for ~2 projected exits. Prioritise Software Engineer and Project Manager roles where GM% exceeds 13.5%.`,
    },
    {
      color: DECK.amber,
      title: `Improve low-margin placements - ${lowMargin.length} employees below 12% GM`,
      body: `${lowMargin.map(e => e.name).join(', ') || 'No employees currently below 12% GM'}. Renegotiate daily rates at next contract renewal or redeploy to higher-value clients.`,
    },
    {
      color: DECK.green,
      title: `Diversify client concentration - top client at ${m.totalRev ? Math.round(topClient.rev / m.totalRev * 100) : 0}% of revenue`,
      body: `${topClient.hc} employees placed with ${topClient.client} (${fmtDeck(topClient.rev)} p.a.). ${secondClient.client} and ${thirdClient.client} under-penetrated. Target 2 new logos by Q4 ${m.currentYear + 1}.`,
    },
  ];
  recs.forEach((rec, i) => {
    const y = 1.25 + i * 0.82;
    s.addShape(shp.ellipse, { x: 0.66, y, w: 0.34, h: 0.34, fill: { color: rec.color }, line: { transparency: 100 } });
    s.addText(String(i + 1), { x: 0.66, y: y + 0.08, w: 0.34, h: 0.11, fontSize: 8.5, bold: true, color: DECK.white, align: 'center', margin: 0 });
    s.addText(rec.title, { x: 1.18, y: y - 0.02, w: 7.85, h: 0.18, fontSize: 11.5, bold: true, color: DECK.white, margin: 0 });
    s.addText(rec.body, { x: 1.18, y: y + 0.24, w: 7.85, h: 0.32, fontSize: 8.2, color: DECK.ice, fit: 'shrink', margin: 0 });
  });
  s.addShape(shp.rect, { x: 0, y: 5.06, w: 10, h: 0.42, fill: transparentFill(DECK.accent, 50), line: { transparency: 100 } });
  s.addText(`Decision Intelligence Dashboard  ·  Data as of ${m.monthYear}  ·  For Director Use Only`, { x: 0.55, y: 5.20, w: 8.9, h: 0.12, fontSize: 8.5, color: DECK.ice, align: 'center', margin: 0 });
}
