import { useState } from 'react';
import { AppBar, Box, Tab, Tabs, Toolbar, Typography } from '@mui/material';
import BacktestPage from './pages/BacktestPage';
import ScannerPage from './pages/ScannerPage';

export default function App() {
  const [tab, setTab] = useState(0);

  return (
    <>
      <AppBar position="static" elevation={1}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ mr: 2 }}>
            NSE Breakout Platform
          </Typography>
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            textColor="inherit"
            indicatorColor="secondary"
          >
            <Tab label="Backtest" />
            <Tab label="Scanner" />
          </Tabs>
        </Toolbar>
      </AppBar>
      <Box>{tab === 0 ? <BacktestPage /> : <ScannerPage />}</Box>
    </>
  );
}
