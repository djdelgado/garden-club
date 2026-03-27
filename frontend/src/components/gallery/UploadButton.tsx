"use client";

import { useState } from "react";
import {
  Button,
  CircularProgress,
  Box,
  Typography,
  Alert,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { apiPost } from "@/lib/api";

interface UploadResponse {
  uploadUrl: string;
  imageKey: string;
}

interface UploadButtonProps {
  eventId: string;
  onUploadSuccess: () => void;
}

export function UploadButton({ eventId, onUploadSuccess }: UploadButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const presignResponse = await apiPost<UploadResponse>("/upload/presign", {
        eventId,
        fileName: file.name,
        contentType: file.type,
      });

      const { uploadUrl, imageKey } = presignResponse;

      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      onUploadSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Button
        variant="contained"
        component="label"
        startIcon={
          loading ? <CircularProgress size={20} /> : <CloudUploadIcon />
        }
        disabled={loading}
      >
        {loading ? "Uploading..." : "Upload Image"}
        <input
          hidden
          accept="image/*"
          type="file"
          onChange={handleFileSelect}
          disabled={loading}
        />
      </Button>
    </Box>
  );
}
