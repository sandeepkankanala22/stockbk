import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = 'http://localhost:3001';
const samplePath = path.join(__dirname, '..', 'sample-input.xlsx');

async function main() {
  console.log('1. Health check...');
  const health = await fetch(`${base}/health`);
  console.log('   ', await health.json());

  console.log('2. Upload sample Excel...');
  const fileBuffer = fs.readFileSync(samplePath);
  const form = new FormData();
  form.append('file', new Blob([fileBuffer]), 'sample-input.xlsx');
  const uploadRes = await fetch(`${base}/api/upload`, { method: 'POST', body: form });
  const upload = await uploadRes.json();
  console.log('   validRows:', upload.validRows, 'uploadId:', upload.uploadId);

  console.log('3. Start backtest...');
  const backtestRes = await fetch(`${base}/api/backtest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId: upload.uploadId,
      targetPercent: 30,
      stoplossPercent: 30,
      sameDayHitMode: 'STOPLOSS_FIRST',
    }),
  });
  const job = await backtestRes.json();
  console.log('   jobId:', job.jobId, 'symbols:', job.symbolCount);

  console.log('4. Poll status...');
  let status;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetch(`${base}/api/status?jobId=${job.jobId}`);
    status = await statusRes.json();
    const p = status.progress;
    console.log(
      `   [${status.status}] ${p.completed}/${p.total} ${p.currentSymbol} (${p.percentComplete}%)`
    );
    if (status.status === 'completed' || status.status === 'failed') break;
  }

  if (status?.status !== 'completed') {
    console.error('Backtest did not complete:', status);
    process.exit(1);
  }

  console.log('5. Fetch results...');
  const resultsRes = await fetch(`${base}/api/results?jobId=${job.jobId}`);
  const results = await resultsRes.json();
  console.log('   Summary:', results.summary);
  console.log('   Results:');
  for (const r of results.results) {
    console.log(`   - ${r.symbol}: ${r.result} (buy: ${r.buyDate}, days: ${r.days})`);
  }

  console.log('\nAll local tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
