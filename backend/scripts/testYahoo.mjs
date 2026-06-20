import yahooFinance from 'yahoo-finance2';

async function main() {
  try {
    const r = await yahooFinance.chart('CESC.NS', {
      period1: '2013-05-01',
      period2: '2024-01-01',
      interval: '1d',
    });
    console.log('success quotes', r.quotes?.length ?? 0);
  } catch (e) {
    console.log('error', e instanceof Error ? e.message : String(e));
    console.log('stack', e instanceof Error ? e.stack : '');
  }
}

main();
