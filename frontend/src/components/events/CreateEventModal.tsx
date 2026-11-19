"use client";

import { useState, useRef, useEffect } from "react";
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
import { ImageService } from "@/services/imageService";
import { EventService } from "@/services/eventService";
import { Event } from "@/types/event";
import { v4 as uuidv4 } from "uuid";

const HOUR_MS = 60 * 60 * 1000;

/** The next whole hour from now, e.g. 10:37 -> 11:00. */
function nextWholeHour(): Date {
  const d = new Date(Date.now() + HOUR_MS);
  d.setMinutes(0, 0, 0);
  return d;
}

const isValidDate = (d: Date | null): d is Date => !!d && !Number.isNaN(d.getTime());

interface CreateEventModalProps {
  open: boolean;
  isEdit?: boolean;
  event?: Event | null;
  onClose: () => void;
  onEventSaved: () => void;
}

export function CreateEventModal({
  open,
  isEdit = false,
  event,
  onClose,
  onEventSaved,
}: CreateEventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState<Date | null>(() => nextWholeHour());
  const [endTime, setEndTime] = useState<Date | null>(
    () => new Date(nextWholeHour().getTime() + HOUR_MS)
  );
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerKey, setBannerKey] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  // What to show as the banner preview: a local object URL for a fresh pick,
  // or the server URL for an existing event's banner.
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && isEdit && event) {
      setTitle(event.title);
      setDescription(event.description);
      setStartTime(new Date(event.startTime));
      setEndTime(new Date(event.endTime));
      setBannerKey(event.headerImageKey ?? null);
      setBannerPreview(event.headerImageUrl ?? null);
      setBannerFile(null);
    }
  }, [open, isEdit, event]);

  // Release local preview object URLs when they are replaced or unmounted.
  useEffect(() => {
    return () => {
      if (bannerPreview?.startsWith("blob:")) URL.revokeObjectURL(bannerPreview);
    };
  }, [bannerPreview]);

  // Picking a start time moves the end time to one hour later, so the common
  // case needs only one picker.
  const handleStartChange = (value: Date | null) => {
    setStartTime(value);
    if (isValidDate(value)) {
      setEndTime(new Date(value.getTime() + HOUR_MS));
    }
  };

  const handleBannerSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file for the banner");
      return;
    }
    setBannerFile(file);
    setBannerUploading(true);
    setError(null);
    try {
      // The content type is signed into the presigned URL, so it must be sent
      // on presign and on the PUT, and both must match.
      const uploads = await ImageService.presignUpload("event-banners", [
        { fileName: file.name, contentType: file.type },
      ]);
      const { uploadUrl, imageKey } = uploads[0];
      await ImageService.uploadToS3(uploadUrl, file, file.type);
      setBannerKey(imageKey);
      setBannerPreview(URL.createObjectURL(file));
    } catch (err) {
      console.error("Banner upload failed", err);
      setError("Failed to upload banner image");
      setBannerFile(null);
    } finally {
      setBannerUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !startTime || !endTime) {
      setError("Please fill in all required fields");
      return;
    }
    if (!isValidDate(startTime) || !isValidDate(endTime)) {
      setError("Please enter a valid start and end time");
      return;
    }
    if (endTime <= startTime) {
      setError("End time must be after the start time");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload: Record<string, unknown> = {
        title,
        description,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        headerImageKey: bannerKey ?? undefined,
      };

      if (isEdit && event) {
        await EventService.updateEvent(event.eventId, payload);
      } else {
        await EventService.createEvent({ eventId: uuidv4(), ...payload });
      }

      onEventSaved();
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${isEdit ? "update" : "create"} event`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    const start = nextWholeHour();
    setStartTime(start);
    setEndTime(new Date(start.getTime() + HOUR_MS));
    setBannerFile(null);
    setBannerKey(null);
    setBannerPreview(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? "Edit Event" : "Create New Event"}</DialogTitle>
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
              onChange={handleStartChange}
              disabled={loading}
            />
            <DateTimePicker
              label="End Time"
              value={endTime}
              onChange={(newValue) => setEndTime(newValue)}
              minDateTime={isValidDate(startTime) ? startTime : undefined}
              disabled={loading}
              slotProps={{ textField: { helperText: "Set automatically to 1 hour after the start" } }}
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
              sx={{ maxWidth: "100%", overflowWrap: "anywhere", textAlign: "left" }}
            >
              {bannerUploading
                ? "Uploading..."
                : bannerFile
                ? bannerFile.name
                : "Choose Image"}
            </Button>
            {bannerKey && !bannerUploading && (
              <Typography variant="caption" color="success.main" sx={{ ml: 1 }}>
                Uploaded
              </Typography>
            )}
            {bannerPreview && (
              <Box
                component="img"
                src={bannerPreview}
                alt="Banner preview"
                sx={{
                  display: "block",
                  mt: 1.5,
                  width: "100%",
                  maxHeight: 160,
                  objectFit: "cover",
                  borderRadius: 1,
                }}
              />
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading || bannerUploading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || bannerUploading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading
            ? isEdit
              ? "Saving..."
              : "Creating..."
            : isEdit
            ? "Save changes"
            : "Create Event"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
