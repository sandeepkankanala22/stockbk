import { Paper, Typography, Button, Stack } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { getExportCsvUrl, getExportExcelUrl } from '../services/api';

interface ExportPanelProps {
  jobId: string;
}

export default function ExportPanel({ jobId }: ExportPanelProps) {
  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Export Results
      </Typography>
      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          component="a"
          href={getExportExcelUrl(jobId)}
          download
        >
          Download Excel
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          component="a"
          href={getExportCsvUrl(jobId)}
          download
        >
          Download CSV
        </Button>
      </Stack>
    </Paper>
  );
}
