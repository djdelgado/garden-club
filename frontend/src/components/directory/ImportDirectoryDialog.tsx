"use client";

import { useRef, useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFileOutlined";
import { DirectoryImportResult, DirectoryImportRow } from "@/types/directory";
import { DirectoryService } from "@/services/directoryService";
import { memberErrorMessage } from "@/services/memberService";
import { parseRosterFile, ParsedRoster } from "@/lib/rosterParser";

const PREVIEW_ROWS = 5;
const FIELD_LABELS: Record<keyof DirectoryImportRow, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  address: "Address",
};

interface ImportDirectoryDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful import so the page can refetch. */
  onImported: () => void;
}

/**
 * Pick an .xlsx/.csv roster → preview → import. Matching rows (by email, or by
 * name for rows without one) are updated; the spreadsheet wins, but blank cells
 * never erase existing values.
 */
export function ImportDirectoryDialog({ open, onClose, onImported }: ImportDirectoryDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedRoster | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DirectoryImportResult | null>(null);

  useEffect(() => {
    if (open) {
      setFileName(null);
      setParsed(null);
      setError(null);
      setResult(null);
    }
  }, [open]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setParsed(null);
    setResult(null);
    setError(null);
    try {
      setParsing(true);
      const roster = await parseRosterFile(file);
      if (!roster.rows.length) {
        setError("That file has a header row but no data rows.");
      } else {
        setParsed(roster);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    try {
      setImporting(true);
      setError(null);
      setResult(await DirectoryService.importRows(parsed.rows));
      onImported();
    } catch (err) {
      setError(memberErrorMessage(err, "Import failed"));
    } finally {
      setImporting(false);
    }
  };

  const busy = parsing || importing;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Import Directory Spreadsheet</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {!result && (
            <Typography variant="body2" color="text.secondary">
              Choose an Excel (.xlsx) or CSV file. The first row must be column headers:
              <strong> Name</strong>, <strong>Email</strong>, <strong>Phone</strong>,{" "}
              <strong>Address</strong>. People already in the directory are matched by email
              (or by name if there&apos;s no email) and updated; blank cells never erase
              what&apos;s there.
            </Typography>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {!result && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <Button
                variant="outlined"
                startIcon={parsing ? <CircularProgress size={18} /> : <UploadFileIcon />}
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                {fileName ? "Choose a different file" : "Choose file"}
              </Button>
              {fileName && (
                <Typography variant="body2" color="text.secondary" noWrap>
                  {fileName}
                </Typography>
              )}
            </Box>
          )}

          {parsed && !result && (
            <>
              <Typography variant="subtitle2">
                {parsed.rows.length} {parsed.rows.length === 1 ? "row" : "rows"} ready to import
                {parsed.rows.length > PREVIEW_ROWS && ` (showing the first ${PREVIEW_ROWS})`}
              </Typography>
              <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {parsed.mapped.map((field) => (
                        <TableCell key={field}>{FIELD_LABELS[field]}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parsed.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                      <TableRow key={i}>
                        {parsed.mapped.map((field) => (
                          <TableCell key={field}>{row[field] || "—"}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {parsed.unrecognized.length > 0 && (
                <Alert severity="warning">
                  These columns will be ignored: {parsed.unrecognized.join(", ")}. Rename a column
                  to Name, Email, Phone or Address to include it.
                </Alert>
              )}
            </>
          )}

          {result && (
            <>
              <Alert severity={result.skipped.length ? "warning" : "success"}>
                Added {result.created}, updated {result.updated}
                {result.skipped.length > 0 && `, skipped ${result.skipped.length}`}.
              </Alert>
              {result.skipped.length > 0 && (
                <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1, maxHeight: 240 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Row</TableCell>
                        <TableCell>Reason</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.skipped.map((s) => (
                        <TableRow key={s.row}>
                          {/* +1: row 1 of the data is spreadsheet row 2, under the header. */}
                          <TableCell>{s.row + 1}</TableCell>
                          <TableCell>{s.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        {result ? (
          <Button onClick={onClose} variant="contained">Done</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={busy}>Cancel</Button>
            <Button
              onClick={handleImport}
              variant="contained"
              disabled={!parsed || busy}
              startIcon={importing ? <CircularProgress size={20} /> : undefined}
            >
              {importing ? "Importing..." : "Import"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
