"use client";

import { useState, useRef, DragEvent } from "react";
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
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { apiPost } from "@/lib/api";

interface CreateAlbumDialogProps {
  open: boolean;
  onClose: () => void;
  onAlbumCreated: () => void;
}

export function CreateAlbumDialog({
  open,
  onClose,
  onAlbumCreated,
}: CreateAlbumDialogProps) {
  const [folderName, setFolderName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const imageFiles = Array.from(newFiles).filter((f) =>
      f.type.startsWith("image/")
    );
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...imageFiles.filter((f) => !existingNames.has(f.name))];
    });
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleCreate = async () => {
    if (!folderName.trim()) {
      setError("Please enter an album name");
      return;
    }
    if (files.length === 0) {
      setError("Please add at least one image");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const presignRes = await apiPost<{
        uploads: { uploadUrl: string; imageKey: string; fileName: string }[];
      }>("/upload/presign", {
        folderName: folderName.trim(),
        files: files.map((f) => ({ fileName: f.name })),
      });

      await Promise.all(
        presignRes.uploads.map((upload, idx) =>
          fetch(upload.uploadUrl, { method: "PUT", body: files[idx] })
        )
      );

      onAlbumCreated();
      handleClose();
    } catch {
      setError("Failed to create album. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFolderName("");
    setFiles([]);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Album</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            fullWidth
            label="Album Name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            disabled={uploading}
          />

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => addFiles(e.target.files)}
          />

          <Box
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: "2px dashed",
              borderColor: dragOver ? "primary.main" : "grey.400",
              borderRadius: 2,
              p: 4,
              textAlign: "center",
              cursor: "pointer",
              bgcolor: dragOver ? "action.hover" : "background.paper",
              transition: "border-color 0.2s, background-color 0.2s",
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 48, color: "grey.500", mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Drag & drop images here, or click to select
            </Typography>
          </Box>

          {files.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                {files.length} {files.length === 1 ? "file" : "files"} selected
              </Typography>
              <List dense disablePadding>
                {files.map((f) => (
                  <ListItem key={f.name} disableGutters>
                    <ListItemText
                      primary={f.name}
                      primaryTypographyProps={{ variant: "caption" }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={uploading}
          startIcon={uploading ? <CircularProgress size={20} /> : undefined}
        >
          {uploading ? "Creating..." : "Create Album"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
