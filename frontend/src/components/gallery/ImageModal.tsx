"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal, Box, IconButton, Typography, Button, Alert } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteIcon from "@mui/icons-material/Delete";
import { GardenImage } from "@/types/image";
import Image from "next/image";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ImageService } from "@/services/imageService";
import { imageSrc } from "./ImageGrid";

interface ImageModalProps {
  images: GardenImage[];
  index: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
  onDeleted?: (imageId: string) => void;
}

export function ImageModal({
  images,
  index,
  onNavigate,
  onClose,
  onDeleted,
}: ImageModalProps) {
  const image = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;
  // Intrinsic dimensions, captured once the image loads, so portrait photos
  // render at their true ratio instead of being forced into a square box.
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(index - 1);
  }, [hasPrev, index, onNavigate]);

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(index + 1);
  }, [hasNext, index, onNavigate]);

  // Reset captured dimensions whenever the displayed image changes.
  useEffect(() => {
    setDims(null);
  }, [image?.imageId]);

  // Keyboard navigation: ← / → to step, Esc to close.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goPrev, goNext]);

  // Preload the adjacent images so stepping through an album is instant.
  useEffect(() => {
    [index - 1, index + 1].forEach((i) => {
      const adjacent = images[i];
      if (adjacent) {
        const preload = new window.Image();
        preload.src = imageSrc(adjacent);
      }
    });
  }, [images, index]);

    const { isAdmin } = useIsAdmin();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the delete confirmation when stepping to another image.
  useEffect(() => {
    setConfirming(false);
    setError(null);
  }, [image?.imageId]);

  const handleDelete = async () => {
    if (!image) return;
    setDeleting(true);
    setError(null);
    try {
      await ImageService.deleteImage(image.imageId);
      onDeleted?.(image.imageId);
      // The parent drops the image from `images`, so this index may now be
      // stale; close rather than guess which neighbour to show.
      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to delete image. Please try again.");
      setDeleting(false);
    }
  };

  if (!image) return null;

  return (
    <Modal
      open={true}
      onClose={onClose}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box
        sx={{
          position: "relative",
          bgcolor: "rgba(0,0,0,0.9)",
          borderRadius: 1,
          maxWidth: { xs: "96vw", sm: "90vw" },
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <IconButton
          onClick={onClose}
          aria-label="close"
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            bgcolor: "rgba(255,255,255,0.1)",
            color: "white",
            "&:hover": {
              bgcolor: "rgba(255,255,255,0.2)",
            },
            zIndex: 1,
          }}
        >
          <CloseIcon />
        </IconButton>

        {hasPrev && (
          <IconButton
            onClick={goPrev}
            aria-label="previous image"
            sx={{
              position: "absolute",
              top: "50%",
              left: 8,
              transform: "translateY(-50%)",
              bgcolor: "rgba(255,255,255,0.1)",
              color: "white",
              "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
              zIndex: 1,
            }}
          >
            <ChevronLeftIcon />
          </IconButton>
        )}

        {hasNext && (
          <IconButton
            onClick={goNext}
            aria-label="next image"
            sx={{
              position: "absolute",
              top: "50%",
              right: 8,
              transform: "translateY(-50%)",
              bgcolor: "rgba(255,255,255,0.1)",
              color: "white",
              "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
              zIndex: 1,
            }}
          >
            <ChevronRightIcon />
          </IconButton>
        )}

        <Box
          sx={{
            p: { xs: 1, sm: 2 },
            // Keep the photo inside the box (its max width minus padding) so
            // it never forces a horizontal scroll on phones.
            "& img": { maxWidth: { xs: "calc(96vw - 16px)", sm: "calc(90vw - 32px)" } },
          }}
        >
          <Image
            src={imageSrc(image)}
            alt={image.fileName}
            width={dims?.w ?? 1000}
            height={dims?.h ?? 1000}
            onLoad={(e) =>
              setDims({
                w: e.currentTarget.naturalWidth,
                h: e.currentTarget.naturalHeight,
              })
            }
            style={{
              width: "auto",
              height: "auto",
              maxHeight: "80vh",
              objectFit: "contain",
              borderRadius: "4px",
            }}
          />
          <Typography
            variant="body2"
            sx={{ color: "white", mt: 1, textAlign: "center", overflowWrap: "anywhere" }}
          >
            {image.fileName}
          </Typography>

          {isAdmin && (
            <Box sx={{ mt: 2 }}>
              {error && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  {error}
                </Alert>
              )}
              {confirming ? (
                <Box
                  sx={{
                    display: "flex",
                    gap: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <Typography variant="body2" sx={{ color: "white" }}>
                    Delete this image?
                  </Typography>
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting…" : "Confirm"}
                  </Button>
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    onClick={() => setConfirming(false)}
                    disabled={deleting}
                    sx={{ color: "white", borderColor: "rgba(255,255,255,0.5)" }}
                  >
                    Cancel
                  </Button>
                </Box>
              ) : (
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={() => {
                      setError(null);
                      setConfirming(true);
                    }}
                  >
                    Delete
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Modal>
  );
}
