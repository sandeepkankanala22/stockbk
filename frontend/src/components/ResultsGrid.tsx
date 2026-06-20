import { useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import { Paper, Typography, Box } from '@mui/material';
import type { TradeResult, TradeResultType } from '../types';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

interface ResultsGridProps {
  results: TradeResult[];
  showPredictions?: boolean;
}

const resultColors: Record<TradeResultType, string> = {
  TARGET: '#e8f5e9',
  STOPLOSS: '#ffebee',
  NO_BREAKOUT: '#f5f5f5',
  OPEN: '#fff3e0',
  ERROR: '#ffcdd2',
};

const resultSortOrder: Record<TradeResultType, number> = {
  OPEN: 0,
  NO_BREAKOUT: 1,
  TARGET: 2,
  STOPLOSS: 3,
  ERROR: 4,
};

export default function ResultsGrid({ results, showPredictions }: ResultsGridProps) {
  const columnDefs = useMemo<ColDef<TradeResult>[]>(() => {
    const base: ColDef<TradeResult>[] = [
      { field: 'symbol', headerName: 'Symbol', filter: true, pinned: 'left' },
      { field: 'minDate', headerName: 'Min Date', filter: true },
      { field: 'buyPrice', headerName: 'Buy Price', filter: 'agNumberColumnFilter' },
      { field: 'buyDate', headerName: 'Buy Date', filter: true },
      { field: 'targetPrice', headerName: 'Target Price', filter: 'agNumberColumnFilter' },
      { field: 'stoplossPrice', headerName: 'Stoploss Price', filter: 'agNumberColumnFilter' },
      { field: 'result', headerName: 'Result', filter: true, sort: 'asc', comparator: (a: string, b: string) =>
          (resultSortOrder[a as TradeResultType] ?? 99) -
          (resultSortOrder[b as TradeResultType] ?? 99),
      },
      { field: 'resultDate', headerName: 'Result Date', filter: true },
      { field: 'days', headerName: 'Days', filter: 'agNumberColumnFilter' },
      {
        headerName: 'SL Hit Till Date',
        valueGetter: (p) => {
          const hit = p.data?.stoplossHitTillDate;
          if (hit == null) return '';
          return hit ? 'Yes' : 'No';
        },
        filter: true,
      },
      { field: 'stoplossHitDate', headerName: 'SL Hit Date', filter: true },
      { field: 'stoplossHitDays', headerName: 'SL Hit Days', filter: 'agNumberColumnFilter' },
      { field: 'firstHit', headerName: 'First Hit', filter: true },
      {
        headerName: 'SL After Target',
        valueGetter: (p) => {
          const v = p.data?.stoplossAfterTargetHit;
          if (v == null) return '';
          return v ? 'Yes' : 'No';
        },
        filter: true,
      },
      {
        headerName: 'Target After SL',
        valueGetter: (p) => {
          const v = p.data?.targetAfterStoplossHit;
          if (v == null) return '';
          return v ? 'Yes' : 'No';
        },
        filter: true,
      },
      {
        headerName: 'Recovered To Buy',
        valueGetter: (p) => {
          const v = p.data?.recoveredToBuyAfterSl;
          if (v == null) return '';
          return v ? 'Yes' : 'No';
        },
        filter: true,
      },
      { field: 'recoveryDate', headerName: 'Recovery Date', filter: true },
      {
        headerName: '2nd SL Hit',
        valueGetter: (p) => {
          const v = p.data?.secondStoplossHit;
          if (v == null) return '';
          return v ? 'Yes' : 'No';
        },
        filter: true,
      },
      { field: 'secondStoplossHitDate', headerName: '2nd SL Hit Date', filter: true },
      { field: 'exitPrice', headerName: 'Exit Price', filter: 'agNumberColumnFilter' },
      { field: 'investmentAmount', headerName: 'Investment (INR)', filter: 'agNumberColumnFilter' },
      { field: 'exitValue', headerName: 'Exit Value (INR)', filter: 'agNumberColumnFilter' },
      { field: 'pnl', headerName: 'P&L (INR)', filter: 'agNumberColumnFilter' },
      { field: 'returnPercent', headerName: 'Return (%)', filter: 'agNumberColumnFilter' },
    ];

    if (showPredictions) {
      base.push(
        {
          headerName: 'P(TARGET) %',
          valueGetter: (p) => p.data?.prediction?.targetProbability ?? null,
          filter: 'agNumberColumnFilter',
        },
        {
          headerName: 'Predicted',
          valueGetter: (p) => p.data?.prediction?.predictedClass ?? '',
          filter: true,
        },
        {
          headerName: 'Confidence',
          valueGetter: (p) => p.data?.prediction?.confidence ?? '',
          filter: true,
        },
        {
          headerName: 'Match',
          valueGetter: (p) =>
            p.data?.prediction?.predictionMatch == null
              ? ''
              : p.data.prediction.predictionMatch
                ? 'Yes'
                : 'No',
          filter: true,
        },
        {
          headerName: 'Top Reasons',
          valueGetter: (p) => p.data?.prediction?.topReasons?.join(' | ') ?? '',
          flex: 2,
          minWidth: 280,
        }
      );
    }

    base.push(
      { field: 'status', headerName: 'Status', filter: true },
      { field: 'errorMessage', headerName: 'Error Message', filter: true },
      { field: 'monthHighDate', headerName: 'Month High Date', filter: true },
      {
        field: 'breakoutCandleHigh',
        headerName: 'Breakout Candle High',
        filter: 'agNumberColumnFilter',
      }
    );

    return base;
  }, [showPredictions]);

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      resizable: true,
      floatingFilter: true,
    }),
    []
  );

  const getRowStyle = useCallback((params: { data?: TradeResult }) => {
    if (!params.data) return undefined;
    return { backgroundColor: resultColors[params.data.result] };
  }, []);

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Results ({results.length} symbols)
      </Typography>
      <Box className="ag-theme-alpine" sx={{ height: 500, width: '100%' }}>
        <AgGridReact
          rowData={results}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          pagination
          paginationPageSize={25}
          paginationPageSizeSelector={[10, 25, 50, 100]}
          getRowStyle={getRowStyle}
          animateRows
        />
      </Box>
    </Paper>
  );
}
