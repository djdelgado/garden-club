"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
  Typography,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { apiPost } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

interface CreateEventModalProps {
  open: boolean;
  onClose: () => void;
  onEventCreated: () => void;
}

export function CreateEventModal({
  open,
  onClose,
  onEventCreated,
}: CreateEventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState<Date | null>(new Date());
  const [endTime, setEndTime] = useState<Date | null>(
    new Date(Date.now() + 3600000)
  );
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerKey, setBannerKey] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBannerSelect = async (file: File) => {
    setBannerFile(file);
    setBannerUploading(true);
    setError(null);
    try {
      const presignRes = await apiPost<{
        uploads: { uploadUrl: string; imageKey: string }[];
      }>("/upload/presign", {
        folderName: "event-banners",
        files: [{ fileName: file.name }],
      });
      const { uploadUrl, imageKey } = presignRes.uploads[0];
      await fetch(uploadUrl, { method: "PUT", body: file });
      setBannerKey(imageKey);
    } catch {
      setError("Failed to upload banner image");
      setBannerFile(null);
    } finally {
      setBannerUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !description.trim() || !startTime || !endTime) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const newEvent: Record<string, unknown> = {
        eventId: uuidv4(),
        title,
        description,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      };

      if (bannerKey) {
        newEvent.headerImageKey = bannerKey;
      }

      await apiPost("/events", newEvent);
      onEventCreated();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setStartTime(new Date());
    setEndTime(new Date(Date.now() + 3600000));
    setBannerFile(null);
    setBannerKey(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Event</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            fullWidth
            label="Event Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
          />

          <TextField
            fullWidth
            label="Description"
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DateTimePicker
              label="Start Time"
              value={startTime}
              onChange={(newValue) => setStartTime(newValue)}
              disabled={loading}
            />
            <DateTimePicker
              label="End Time"
              value={endTime}
              onChange={(newValue) => setEndTime(newValue)}
              disabled={loading}
            />
          </LocalizationProvider>

          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Banner Image (optional)
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBannerSelect(file);
              }}
            />
            <Button
              variant="outlined"
              startIcon={bannerUploading ? <CircularProgress size={18} /> : <CloudUploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || bannerUploading}
              size="small"
            >
              {bannerUploading
                ? "Uploading..."
                : bannerFile
                ? bannerFile.name
                : "Choose Image"}
            </Button>
            {bannerKey && (
              <Typography variant="caption" color="success.main" sx={{ ml: 1 }}>
                Uploaded
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading || bannerUploading}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={loading || bannerUploading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? "Creating..." : "Create Event"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
