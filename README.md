# NSE Breakout Backtesting Application

Production-ready React + Node.js web application for NSE breakout strategy backtesting.

## Features

- Upload Excel files with Date and Symbol columns
- Fetch historical NSE data from Yahoo Finance (`.NS` symbols)
- Execute breakout backtesting strategy with configurable target/stoploss
- Real-time progress tracking with ETA
- AG Grid results with sorting, filtering, and pagination
- Export to Excel (4 sheets) and CSV

## Tech Stack

**Frontend:** React, Material UI, React Query, Axios, AG Grid  
**Backend:** Node.js, Express, yahoo-finance2, DayJS, ExcelJS, node-cache

## Prerequisites

- Node.js 18+
- npm 9+

## Setup

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5174
- Backend API: http://localhost:3001

## Input Excel Format

| Date        | Symbol   |
| ----------- | -------- |
| 02 May 2013 | RELIANCE |
| 10 Mar 2020 | RELIANCE |
| 15 Jan 2021 | TCS      |

Supported date formats: `02 May 2013`, Excel date serial numbers, `YYYY-MM-DD`

## Strategy Overview

1. For each unique symbol, keep the minimum date
2. Buy Price = highest high in the min-date calendar month
3. Scan from first trading day of next month for breakout (daily high > buy price)
4. Monitor target/stoploss from buy date; same-candle rule configurable

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload Excel file |
| POST | `/api/backtest` | Start backtest job |
| GET | `/api/status?jobId=` | Job progress |
| GET | `/api/results?jobId=` | Results and summary |
| GET | `/api/export/excel?jobId=` | Download Excel |
| GET | `/api/export/csv?jobId=` | Download CSV |
| POST | `/api/reset` | Clear state |

## Scripts

```bash
npm run dev          # Run frontend + backend
npm run dev:backend  # Backend only
npm run dev:frontend # Frontend only
npm run build        # Build both
npm test             # Run backend tests
```

## License

Private use.
