const symbol = 'RELIANCE.NS';
const period1 = Math.floor(new Date('2013-05-01').getTime() / 1000);
const period2 = Math.floor(Date.now() / 1000);
const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&includePrePost=false`;

async function test(label, headers) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  console.log(label, 'status', res.status, 'bodyStart', text.slice(0, 80));
  if (res.ok) {
    const json = JSON.parse(text);
    const count = json?.chart?.result?.[0]?.timestamp?.length ?? 0;
    console.log(label, 'bars', count);
  }
}

await test('default', { 'User-Agent': 'Mozilla/5.0' });
await test('withAccept', {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
});
