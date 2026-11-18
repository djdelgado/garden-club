"use client";

import { useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { DirectoryEntry } from "@/types/directory";
import { DirectoryService } from "@/services/directoryService";
import { memberErrorMessage } from "@/services/memberService";

interface DirectoryEntryDialogProps {
  open: boolean;
  /** When set, edits this entry; otherwise adds a new one. */
  entry?: DirectoryEntry | null;
  onClose: () => void;
  onSaved: (entry: DirectoryEntry) => void;
}

/** Add / edit a directory entry. Adding never creates an app account. */
export function DirectoryEntryDialog({ open, entry, onClose, onSaved }: DirectoryEntryDialogProps) {
  const isEdit = Boolean(entry);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(entry?.name ?? "");
      setEmail(entry?.email ?? "");
      setPhone(entry?.phone ?? "");
      setAddress(entry?.address ?? "");
      setError(null);
    }
  }, [open, entry]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    const input = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
    };
    try {
      setLoading(true);
      setError(null);
      const saved = isEdit && entry
        ? await DirectoryService.update(entry.entryId, input)
        : await DirectoryService.create(input);
      onSaved(saved);
    } catch (err) {
      setError(memberErrorMessage(err, isEdit ? "Failed to update entry" : "Failed to add entry"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? "Edit Directory Entry" : "Add to Directory"}</DialogTitle>
      <DialogContent>
        <Box
          component="form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}
        >
          {error && <Alert severity="error">{error}</Alert>}
          {!isEdit && (
            <Alert severity="info">
              This adds the person to the club directory only. It doesn&apos;t create an app
              login; use &ldquo;Invite to app&rdquo; on their card for that.
            </Alert>
          )}
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} required fullWidth autoFocus />
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} fullWidth />
          <TextField label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} fullWidth />
          <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} disabled={loading} fullWidth multiline minRows={2} />
          {/* Lets Enter submit from a single-line field. */}
          <button type="submit" hidden />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? "Saving..." : isEdit ? "Save Changes" : "Add Entry"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
