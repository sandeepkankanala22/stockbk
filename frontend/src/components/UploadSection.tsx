import { useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { UploadResponse } from '../types';

interface UploadSectionProps {
  onFileSelected: (file: File) => void;
  uploadInfo: UploadResponse | null;
  disabled?: boolean;
}

export default function UploadSection({ onFileSelected, uploadInfo, disabled }: UploadSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');

  const processFile = (file: File) => {
    setFileName(file.name);
    onFileSelected(file);
  };

  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Typography variant="h6" gutterBottom>
        Upload File
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Excel (.xlsx, .xls) or CSV (.csv) with Date and Symbol columns. Date formats: 02 May 2013,
        2013-05-02.
      </Typography>

      <Box
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) processFile(file);
        }}
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'grey.300',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          bgcolor: dragOver ? 'action.hover' : 'background.default',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography>{fileName || 'Drag & drop Excel/CSV file or click to browse'}</Typography>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
          }}
        />
      </Box>

      {uploadInfo && (
        <Box sx={{ mt: 2 }}>
          <Alert severity={uploadInfo.invalidRows.length > 0 ? 'warning' : 'success'}>
            {uploadInfo.validRows} valid rows, {uploadInfo.invalidRows.length} invalid,{' '}
            {uploadInfo.duplicatesRemoved} duplicates removed
          </Alert>

          {uploadInfo.invalidRows.length > 0 && (
            <Accordion sx={{ mt: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Invalid Rows ({uploadInfo.invalidRows.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Row</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Symbol</TableCell>
                      <TableCell>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {uploadInfo.invalidRows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.rowIndex}</TableCell>
                        <TableCell>{row.rawDate}</TableCell>
                        <TableCell>{row.symbol}</TableCell>
                        <TableCell>{row.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionDetails>
            </Accordion>
          )}
        </Box>
      )}
    </Paper>
  );
}
