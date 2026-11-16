"use client";

import { Modal, Box, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { GardenImage } from "@/types/image";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { imageSrc } from "./ImageGrid";

interface ImageModalProps {
  images: GardenImage[];
  index: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
}

export function ImageModal({
  images,
  index,
  onNavigate,
  onClose,
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
          maxWidth: "90vw",
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

        <Box sx={{ p: 2 }}>
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
              maxWidth: "86vw",
              maxHeight: "80vh",
              objectFit: "contain",
              borderRadius: "4px",
            }}
          />
          <Typography
            variant="body2"
            sx={{ color: "white", mt: 1, textAlign: "center" }}
          >
            {image.fileName}
          </Typography>
        </Box>
      </Box>
    </Modal>
  );
}
