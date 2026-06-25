import { Paper, Typography, TextField, MenuItem, Grid } from '@mui/material';
import type { BacktestConfig, SameDayHitMode } from '../types';

interface ConfigInputsProps {
  config: BacktestConfig;
  onChange: (config: BacktestConfig) => void;
  disabled?: boolean;
}

export default function ConfigInputs({ config, onChange, disabled }: ConfigInputsProps) {
  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Typography variant="h6" gutterBottom>
        Strategy Parameters
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Target Percentage"
            type="number"
            inputProps={{ min: 0, max: 100, step: 0.1 }}
            value={config.targetPercent}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...config, targetPercent: parseFloat(e.target.value) || 0 })
            }
            helperText="0–100, decimals allowed"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Stoploss Percentage"
            type="number"
            inputProps={{ min: 0, max: 100, step: 0.1 }}
            value={config.stoplossPercent}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...config, stoplossPercent: parseFloat(e.target.value) || 0 })
            }
            helperText="0–100, decimals allowed"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Investment Amount (INR)"
            type="number"
            inputProps={{ min: 1, step: 1000 }}
            value={config.investmentAmount}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...config, investmentAmount: parseFloat(e.target.value) || 0 })
            }
            helperText="Capital deployed per trade (used for P&L, ROI, CAGR)"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Near Buy Band — Plus %"
            type="number"
            inputProps={{ min: 0, max: 100, step: 0.1 }}
            value={config.nearBuyPlusPct}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...config, nearBuyPlusPct: parseFloat(e.target.value) || 0 })
            }
            helperText="Distance to +% band from buy (Top 10 & Dist column)"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Near Buy Band — Minus %"
            type="number"
            inputProps={{ min: 0, max: 100, step: 0.1 }}
            value={config.nearBuyMinusPct}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...config, nearBuyMinusPct: parseFloat(e.target.value) || 0 })
            }
            helperText="Distance to -% band from buy (Top 10 & Dist column)"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            select
            label="Same Candle Hit Mode"
            value={config.sameDayHitMode}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...config, sameDayHitMode: e.target.value as SameDayHitMode })
            }
            helperText="If target and stoploss are both hit on the same day, which outcome to record"
          >
            <MenuItem value="STOPLOSS_FIRST">Stoploss First (Conservative)</MenuItem>
            <MenuItem value="TARGET_FIRST">Target First</MenuItem>
          </TextField>
        </Grid>
      </Grid>
    </Paper>
  );
}
