"use client";

import { useState, useRef, DragEvent, useEffect } from "react";
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
  LinearProgress,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { ImageService } from "@/services/imageService";
import { outputContentType, processImage } from "@/lib/imageResize";
import { DeleteAlbumBtn } from "./DeleteAlbumBtn";

interface CreateAlbumDialogProps {
  open: boolean;
  isEdit?: boolean;
  folderData?: { folderName: string };
  onClose: () => void;
  onAlbumChanged: () => void;
}

// Max 25 MB per file (matches the optional acceptance criterion).
const MAX_FILE_BYTES = 25 * 1024 * 1024;
// Cap concurrent S3 PUTs so large batches don't swamp the browser's
// ~6-connections-per-host limit (which starved late uploads under Promise.all).
const UPLOAD_CONCURRENCY = 4;

type UploadStatus = "pending" | "uploading" | "done" | "error";

interface UploadInfo {
  status: UploadStatus;
  uploadUrl?: string;
  thumbUploadUrl?: string;
  imageId?: string;
  contentType?: string;
}

// Run `worker` over `items` with at most `concurrency` in flight at once.
async function runPool<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number
): Promise<void> {
  let index = 0;
  const run = async () => {
    while (index < items.length) {
      const current = index++;
      await worker(items[current]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, run)
  );
}

const STATUS_LABELS: Record<UploadStatus, string> = {
  pending: "Waiting…",
  uploading: "Uploading…",
  done: "Uploaded",
  error: "Failed",
};

export function CreateAlbumDialog({
  open = false,
  isEdit = false,
  folderData,
  onClose,
  onAlbumChanged,
}: CreateAlbumDialogProps) {
  const [folderName, setFolderName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadState, setUploadState] = useState<Record<string, UploadInfo>>({});
  // True once anything was persisted (rename or at least one READY image), so
  // closing the dialog refreshes the parent even after a partial failure.
  // A ref, not state: it is read synchronously right after being set.
  const dirtyRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && folderData) {
      setFolderName(folderData.folderName);
    }
  }, [open, folderData]);

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const imageFiles = Array.from(newFiles).filter((f) =>
      f.type.startsWith("image/")
    );

    const tooLarge = imageFiles.filter((f) => f.size > MAX_FILE_BYTES);
    if (tooLarge.length > 0) {
      setError(
        `These files exceed the 25 MB limit and were skipped: ${tooLarge
          .map((f) => f.name)
          .join(", ")}`
      );
    } else {
      setError(null);
    }
    const allowed = imageFiles.filter((f) => f.size <= MAX_FILE_BYTES);

    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...allowed.filter((f) => !existingNames.has(f.name))];
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

    if (isEdit) {
      const nameChanged = folderName.trim() !== folderData?.folderName;
      if (!nameChanged && files.length === 0) {
        setError("Album name is unchanged");
        return;
      }

      setUploading(true);
      setError(null);
      try {
        if (nameChanged) {
          await ImageService.updateFolder(
            folderData?.folderName ?? "",
            folderName.trim()
          );
          dirtyRef.current = true;
        }
        // Only presign/upload when the admin actually added files, so a
        // pure rename doesn't hit the empty-files 400 from /upload/presign.
        const allOk = files.length === 0 ? true : await uploadImages();
        // Don't notify the parent on partial failure: its handler closes the
        // dialog, which would hide the per-file Retry buttons.
        if (allOk) {
          handleClose();
        } else {
          setError("Some images failed to upload. Retry the failed files below.");
        }
      } catch {
        setError("Failed to update album. Please try again.");
      } finally {
        setUploading(false);
      }
      return;
    }

    if (files.length === 0) {
      setError("Please add at least one image");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const allOk = await uploadImages();
      if (allOk) {
        handleClose();
      } else {
        setError("Some images failed to upload. Retry the failed files below.");
      }
    } catch {
      setError("Failed to create album. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // Upload one file to its presigned URL, tracking per-file status.
  const uploadOne = async (info: {
    fileName: string;
    uploadUrl: string;
    thumbUploadUrl: string;
    imageId: string;
    file: File;
  }): Promise<boolean> => {
    setUploadState((s) => ({
      ...s,
      [info.fileName]: { ...s[info.fileName], status: "uploading" },
    }));
    try {
      // Resize inside the worker slot so a large batch never decodes every
      // photo at once (see lib/imageResize), then PUT original + thumbnail.
      const processed = await processImage(info.file);
      await ImageService.uploadToS3(info.uploadUrl, processed.original, processed.contentType);
      await ImageService.uploadToS3(info.thumbUploadUrl, processed.thumb, processed.contentType);
      setUploadState((s) => ({
        ...s,
        [info.fileName]: { ...s[info.fileName], status: "done" },
      }));
      return true;
    } catch {
      setUploadState((s) => ({
        ...s,
        [info.fileName]: { ...s[info.fileName], status: "error" },
      }));
      return false;
    }
  };

  // Returns true only if every file was successfully PUT to S3.
  const uploadImages = async (): Promise<boolean> => {
    const uploads = await ImageService.presignUpload(
      folderName.trim(),
      files.map((f) => ({ fileName: f.name, contentType: outputContentType(f) }))
    );

    const byName = new Map(files.map((f) => [f.name, f]));

    // Seed per-file state so the list renders progress immediately.
    setUploadState(() => {
      const next: Record<string, UploadInfo> = {};
      uploads.forEach((u) => {
        const file = byName.get(u.fileName);
        next[u.fileName] = {
          status: "pending",
          uploadUrl: u.uploadUrl,
          thumbUploadUrl: u.thumbUploadUrl,
          imageId: u.imageId,
          contentType: file ? outputContentType(file) : undefined,
        };
      });
      return next;
    });

    const successfulIds: string[] = [];
    await runPool(
      uploads,
      async (u) => {
        const file = byName.get(u.fileName);
        if (!file) return;
        const ok = await uploadOne({
          fileName: u.fileName,
          uploadUrl: u.uploadUrl,
          thumbUploadUrl: u.thumbUploadUrl,
          imageId: u.imageId,
          file,
        });
        if (ok) successfulIds.push(u.imageId);
      },
      UPLOAD_CONCURRENCY
    );

    // Only flip successfully-PUT objects to READY — never mark a failed
    // (403/5xx) upload ready, which used to leave broken tiles in the gallery.
    if (successfulIds.length > 0) {
      await ImageService.completeUpload(successfulIds);
      dirtyRef.current = true;
    }

    return successfulIds.length === uploads.length;
  };

  const handleRetry = async (fileName: string) => {
    const info = uploadState[fileName];
    const file = files.find((f) => f.name === fileName);
    if (!info?.uploadUrl || !info.thumbUploadUrl || !info.imageId || !file) return;
    // Presigned URLs are valid for 15 min and the key is single-use per
    // object, so a failed PUT can be retried against the same URL.
    const ok = await uploadOne({
      fileName,
      uploadUrl: info.uploadUrl,
      thumbUploadUrl: info.thumbUploadUrl,
      imageId: info.imageId,
      file,
    });
    if (ok) {
      try {
        await ImageService.completeUpload([info.imageId]);
        dirtyRef.current = true;
      } catch {
        setUploadState((s) => ({
          ...s,
          [fileName]: { ...s[fileName], status: "error" },
        }));
      }
    }
  };

  const handleClose = () => {
    const changed = dirtyRef.current;
    dirtyRef.current = false;
    setFolderName("");
    setFiles([]);
    setError(null);
    setUploadState({});
    // Parents' onAlbumChanged both closes the dialog and refreshes the list.
    if (changed) {
      onAlbumChanged();
    } else {
      onClose();
    }
  };

  const statuses = Object.values(uploadState);
  const hasUploadState = statuses.length > 0;
  const doneCount = statuses.filter((u) => u.status === "done").length;
  const anyUploading =
    uploading || statuses.some((u) => u.status === "uploading");
  const overallPct = hasUploadState
    ? (doneCount / statuses.length) * 100
    : 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? "Edit Album" : "New Album"}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            fullWidth
            label="Album Name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            disabled={anyUploading}
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

              {hasUploadState && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {doneCount} of {statuses.length} uploaded
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={overallPct}
                    sx={{ mt: 0.5 }}
                  />
                </Box>
              )}

              <List dense disablePadding sx={{ mt: 1 }}>
                {files.map((f) => {
                  const info = uploadState[f.name];
                  return (
                    <ListItem
                      key={f.name}
                      disableGutters
                      secondaryAction={
                        info?.status === "error" ? (
                          <Button
                            size="small"
                            onClick={() => handleRetry(f.name)}
                            disabled={anyUploading}
                          >
                            Retry
                          </Button>
                        ) : undefined
                      }
                    >
                      <ListItemText
                        primary={f.name}
                        secondary={
                          info ? (
                            info.status === "uploading" ? (
                              <LinearProgress sx={{ mt: 0.5, maxWidth: 200 }} />
                            ) : (
                              STATUS_LABELS[info.status]
                            )
                          ) : undefined
                        }
                        slotProps={{
                          primary: { variant: "caption" },
                          secondary: {
                            // The uploading row nests a LinearProgress (a div),
                            // which is invalid inside the default <p>.
                            component: "div",
                            variant: "caption",
                            color:
                              info?.status === "error"
                                ? "error"
                                : "text.secondary",
                          },
                        }}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        {isEdit && (
          <DeleteAlbumBtn
            folderName={folderData?.folderName || ""}
            onDeleted={() => onAlbumChanged()}
          />
        )}
        <Button onClick={handleClose} disabled={anyUploading}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={anyUploading}
          startIcon={anyUploading ? <CircularProgress size={20} /> : undefined}
        >
          {isEdit ? "Update" : "Create Album"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
