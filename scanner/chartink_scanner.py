#!/usr/bin/env python3
"""
Chartink scanner — standalone Python reference implementation.
Mirrors backend/src/scanner/chartinkConditions.ts logic.

Usage:
  pip install yfinance pandas numpy
  python scanner/chartink_scanner.py --symbol RELIANCE
  python scanner/chartink_scanner.py --symbols RELIANCE,TCS,INFY --export signals.csv
"""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from datetime import datetime
from typing import Iterable

import numpy as np
import pandas as pd

try:
    import yfinance as yf
except ImportError as exc:
    raise SystemExit("Install yfinance: pip install yfinance pandas numpy") from exc

EMA_PERIODS = [20, 25, 30, 35, 40, 45, 50, 55]
LONG_WINDOW = 200
SHORT_WINDOW = 100
MONTHS_OFFSET = 49


@dataclass
class Signal:
    symbol: str
    company: str
    signal_date: str
    entry_price: float
    current_price: float
    return_pct: float
    return_3m_pct: float | None
    return_6m_pct: float | None
    return_12m_pct: float | None
    max_gain_pct: float | None
    max_drawdown_pct: float | None


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def rolling_max(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window=window, min_periods=window).max()


def highs_equal(a: float, b: float) -> bool:
    scale = max(abs(a), abs(b), 1.0)
    return abs(a - b) <= scale * 1e-6


def technical_hits(df: pd.DataFrame) -> list[int]:
    hits: list[int] = []
    if len(df) <= LONG_WINDOW:
        return hits

    emas = {p: ema(df["Close"], p) for p in EMA_PERIODS}
    max200 = rolling_max(df["High"], LONG_WINDOW)
    max100_offset = rolling_max(df["High"], SHORT_WINDOW).shift(MONTHS_OFFSET)

    for i in range(LONG_WINDOW - 1, len(df)):
        row = df.iloc[i]
        greatest_ema = max(emas[p].iloc[i] for p in EMA_PERIODS)
        least_ema = min(emas[p].iloc[i] for p in EMA_PERIODS)

        if not (row["Close"] > greatest_ema):
            continue
        if not (row["Open"] < least_ema):
            continue

        m200 = max200.iloc[i]
        m100 = max100_offset.iloc[i]
        if pd.isna(m200) or pd.isna(m100) or not highs_equal(float(m200), float(m100)):
            continue
        if not (row["High"] > float(m200) * 0.5):
            continue
        hits.append(i)
    return hits


def pct_change(from_price: float, to_price: float) -> float:
    return round((to_price / from_price - 1) * 100, 2)


def build_metrics(symbol: str, company: str, df: pd.DataFrame, idx: int) -> Signal:
    entry = float(df["Close"].iloc[idx])
    current = float(df["Close"].iloc[-1])
    future = df.iloc[idx + 1 :]
    max_high = float(future["High"].max()) if len(future) else entry
    min_low = float(future["Low"].min()) if len(future) else entry

    def fwd(months: int) -> float | None:
        j = idx + months
        return float(df["Close"].iloc[j]) if j < len(df) else None

    c3, c6, c12 = fwd(3), fwd(6), fwd(12)
    date = df.index[idx].strftime("%Y-%m-%d")

    return Signal(
        symbol=symbol,
        company=company,
        signal_date=date,
        entry_price=round(entry, 2),
        current_price=round(current, 2),
        return_pct=pct_change(entry, current),
        return_3m_pct=pct_change(entry, c3) if c3 is not None else None,
        return_6m_pct=pct_change(entry, c6) if c6 is not None else None,
        return_12m_pct=pct_change(entry, c12) if c12 is not None else None,
        max_gain_pct=pct_change(entry, max_high),
        max_drawdown_pct=pct_change(entry, min_low),
    )


def fetch_monthly(symbol: str, start: str = "2004-01-01") -> pd.DataFrame:
    ticker = f"{symbol}.NS"
    data = yf.download(ticker, start=start, interval="1mo", progress=False, auto_adjust=False)
    if data.empty:
        raise ValueError(f"No data for {symbol}")
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)
    return data.dropna()


def scan_symbol(symbol: str, company: str = symbol, fundamentals_ok: bool = True) -> list[Signal]:
    df = fetch_monthly(symbol)
    signals: list[Signal] = []
    for idx in technical_hits(df):
        if not fundamentals_ok:
            continue
        signals.append(build_metrics(symbol, company, df, idx))
    return signals


def export_csv(path: str, signals: Iterable[Signal]) -> None:
    rows = list(signals)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "Symbol",
                "Company",
                "Signal Date",
                "Entry Price",
                "Current Price",
                "Return %",
                "3 Month Return %",
                "6 Month Return %",
                "12 Month Return %",
                "Max Gain %",
                "Max Drawdown %",
            ]
        )
        for s in rows:
            w.writerow(
                [
                    s.symbol,
                    s.company,
                    s.signal_date,
                    s.entry_price,
                    s.current_price,
                    s.return_pct,
                    s.return_3m_pct,
                    s.return_6m_pct,
                    s.return_12m_pct,
                    s.max_gain_pct,
                    s.max_drawdown_pct,
                ]
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Chartink monthly scanner (Python)")
    parser.add_argument("--symbol", help="Single NSE symbol")
    parser.add_argument("--symbols", help="Comma-separated symbols")
    parser.add_argument("--export", help="CSV export path")
    args = parser.parse_args()

    symbols = []
    if args.symbol:
        symbols.append(args.symbol.upper())
    if args.symbols:
        symbols.extend(s.strip().upper() for s in args.symbols.split(",") if s.strip())

    if not symbols:
        parser.error("Provide --symbol or --symbols")

    all_signals: list[Signal] = []
    for sym in symbols:
        try:
            all_signals.extend(scan_symbol(sym))
            print(f"{sym}: {len(all_signals)} total signals")
        except Exception as err:
            print(f"{sym}: skip ({err})")

    if args.export:
        export_csv(args.export, all_signals)
        print(f"Exported {len(all_signals)} rows to {args.export}")
    else:
        for s in all_signals:
            print(s)


if __name__ == "__main__":
    main()
