// PDF Report Generator — reads test-results/results.json, generates PDF
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const RESULTS_PATH = path.resolve(__dirname, '../../test-results/results.json');
const OUTPUT_PATH = path.resolve(__dirname, '../../test-results/ERP-V2-Test-Report.pdf');

// QA Fixes mapping
const QA_FIXES = [
  { id: 'S4', desc: 'Cancel resets delivery info' },
  { id: 'S7', desc: '4-decimal quantity display' },
  { id: 'S6', desc: 'Customer persistence on hold' },
  { id: 'P1', desc: 'Searchable item dropdown' },
  { id: 'P2', desc: 'Hide already-selected items' },
  { id: 'P3', desc: 'BOM items in purchase dropdown' },
  { id: 'P4', desc: 'Auto-fill last purchase price' },
  { id: 'P5', desc: 'Purchase hold/suspend' },
  { id: 'P6', desc: 'Remove grams field' },
  { id: 'S1', desc: 'Cash customer default' },
  { id: 'S2/S3', desc: 'Customer search + quick add' },
  { id: 'S5', desc: 'Cancel held invoices' },
  { id: 'S8', desc: 'Show all invoices in return' },
  { id: 'S9', desc: 'No manager auth for delivery settlement' },
  { id: 'S10', desc: 'Expenses linked to shifts' },
  { id: 'S12', desc: 'Enhanced shift report + print' },
  { id: 'B2', desc: 'Auto-produce BOM at POS' },
  { id: 'S11', desc: 'Two-phase delivery flow' },
  { id: 'T1', desc: 'Transfer history shortcut' },
  { id: 'T2', desc: 'Print after transfer save' },
  { id: 'T3', desc: 'Remove grams from transfers' },
  { id: 'B1', desc: 'Edit production quantities' },
  { id: 'BR1', desc: 'Branch balance dashboard cards' },
  { id: 'G1', desc: 'Sticky table headers' },
  { id: 'G2', desc: 'Integer/decimal step inputs' },
  { id: 'SA1', desc: 'Multi-branch assignment' },
];

function generateReport() {
  let results;
  try {
    results = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));
  } catch (e) {
    console.error('Cannot read results.json:', e.message);
    process.exit(1);
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(OUTPUT_PATH);
  doc.pipe(stream);

  const suites = results.suites || [];
  let totalTests = 0, passed = 0, failed = 0, skipped = 0;
  const failedTests = [];
  const categoryResults = {};

  function processSpecs(specs, suiteName) {
    for (const spec of specs) {
      for (const test of (spec.tests || [])) {
        totalTests++;
        const status = test.results?.[0]?.status || test.status || 'unknown';
        if (status === 'passed' || status === 'expected') passed++;
        else if (status === 'skipped') skipped++;
        else {
          failed++;
          failedTests.push({
            suite: suiteName,
            title: spec.title + ' > ' + test.title,
            error: test.results?.[0]?.error?.message || 'Unknown error',
          });
        }

        // Category tracking
        const cat = suiteName.replace(/.*specs[\\/]/, '').split(/[\\/]/)[0] || 'other';
        if (!categoryResults[cat]) categoryResults[cat] = { passed: 0, failed: 0, total: 0 };
        categoryResults[cat].total++;
        if (status === 'passed' || status === 'expected') categoryResults[cat].passed++;
        else categoryResults[cat].failed++;
      }
    }
  }

  function processSuite(suite, parentName = '') {
    const name = parentName ? `${parentName} > ${suite.title}` : suite.title;
    if (suite.specs) processSpecs(suite.specs, name);
    if (suite.suites) {
      for (const sub of suite.suites) processSuite(sub, name);
    }
  }

  for (const suite of suites) processSuite(suite);

  // === COVER PAGE ===
  doc.fontSize(28).font('Helvetica-Bold').text('ERP-V2 System Test Report', { align: 'center' });
  doc.moveDown(2);
  doc.fontSize(14).font('Helvetica').text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'center' });
  doc.text(`Environment: localhost:5173 / localhost:3001`, { align: 'center' });
  doc.text(`Framework: Playwright`, { align: 'center' });
  doc.moveDown(3);

  // === EXECUTIVE SUMMARY ===
  doc.fontSize(20).font('Helvetica-Bold').text('Executive Summary');
  doc.moveDown(0.5);
  doc.fontSize(12).font('Helvetica');
  doc.text(`Total Tests: ${totalTests}`);
  doc.text(`Passed: ${passed}`, { continued: false });
  doc.text(`Failed: ${failed}`);
  doc.text(`Skipped: ${skipped}`);
  doc.text(`Pass Rate: ${totalTests > 0 ? ((passed / totalTests) * 100).toFixed(1) : 0}%`);
  doc.moveDown(1);

  // Health bar
  const barWidth = 400;
  const barHeight = 20;
  const passWidth = totalTests > 0 ? (passed / totalTests) * barWidth : 0;
  const failWidth = totalTests > 0 ? (failed / totalTests) * barWidth : 0;
  doc.rect(doc.x, doc.y, passWidth, barHeight).fill('#22c55e');
  doc.rect(doc.x + passWidth, doc.y - barHeight, failWidth, barHeight).fill('#ef4444');
  doc.rect(doc.x + passWidth + failWidth, doc.y - barHeight, barWidth - passWidth - failWidth, barHeight).fill('#94a3b8');
  doc.moveDown(2);

  // === RESULTS BY CATEGORY ===
  doc.addPage();
  doc.fontSize(20).font('Helvetica-Bold').text('Results by Category');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');

  const catHeaders = ['Category', 'Total', 'Passed', 'Failed', 'Pass Rate'];
  let y = doc.y;
  catHeaders.forEach((h, i) => {
    doc.font('Helvetica-Bold').text(h, 50 + i * 100, y, { width: 100 });
  });
  doc.moveDown(0.5);

  for (const [cat, data] of Object.entries(categoryResults).sort()) {
    y = doc.y;
    doc.font('Helvetica')
      .text(cat, 50, y, { width: 100 })
      .text(String(data.total), 150, y, { width: 100 })
      .text(String(data.passed), 250, y, { width: 100 })
      .text(String(data.failed), 350, y, { width: 100 })
      .text(`${data.total > 0 ? ((data.passed / data.total) * 100).toFixed(0) : 0}%`, 450, y, { width: 100 });
    doc.moveDown(0.3);
  }
  doc.moveDown(1);

  // === 32 QA FIXES STATUS ===
  doc.addPage();
  doc.fontSize(20).font('Helvetica-Bold').text('32 QA Fixes Verification');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');

  const qaHeaders = ['Fix ID', 'Description', 'Status'];
  y = doc.y;
  qaHeaders.forEach((h, i) => {
    doc.font('Helvetica-Bold').text(h, 50 + i * 170, y, { width: 170 });
  });
  doc.moveDown(0.5);

  for (const fix of QA_FIXES) {
    // Check if any test mentions this fix ID
    const qaFailed = failedTests.some(t => t.title.includes(fix.id));
    const status = qaFailed ? 'FAIL' : 'PASS (or not tested)';
    y = doc.y;
    doc.font('Helvetica')
      .text(fix.id, 50, y, { width: 80 })
      .text(fix.desc, 130, y, { width: 250 })
      .text(status, 390, y, { width: 120 });
    doc.moveDown(0.3);
    if (doc.y > 750) doc.addPage();
  }

  // === BUG REGISTER ===
  if (failedTests.length > 0) {
    doc.addPage();
    doc.fontSize(20).font('Helvetica-Bold').text('Bug Register');
    doc.moveDown(0.5);

    for (let i = 0; i < failedTests.length; i++) {
      const bug = failedTests[i];
      doc.fontSize(11).font('Helvetica-Bold').text(`BUG-${String(i + 1).padStart(3, '0')}: ${bug.title}`);
      doc.fontSize(9).font('Helvetica')
        .text(`Suite: ${bug.suite}`)
        .text(`Error: ${bug.error.substring(0, 200)}`);
      doc.moveDown(0.5);
      if (doc.y > 720) doc.addPage();
    }
  }

  // === RECOMMENDATIONS ===
  doc.addPage();
  doc.fontSize(20).font('Helvetica-Bold').text('Recommendations');
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica');
  doc.list([
    'Print output verification requires manual inspection (window.print mock only)',
    'InstaPay payment method tested as recorded value — no external gateway integration',
    'Concurrent user testing limited to dual browser contexts, not load testing',
    'Mobile responsive tested at 768px viewport, not actual devices',
    'Visual regression baselines not established — recommend adding screenshot comparison',
  ]);

  doc.end();

  stream.on('finish', () => {
    console.log(`✅ PDF report generated: ${OUTPUT_PATH}`);
    console.log(`   Total: ${totalTests} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
  });
}

if (require.main === module) {
  generateReport();
}

module.exports = { generateReport };
