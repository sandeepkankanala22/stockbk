export function calculateTargetPrice(buyPrice: number, targetPercent: number): number {
  return buyPrice * (1 + targetPercent / 100);
}

export function calculateStoplossPrice(buyPrice: number, stoplossPercent: number): number {
  return buyPrice * (1 - stoplossPercent / 100);
}

export function roundPrice(price: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(price * factor) / factor;
}
