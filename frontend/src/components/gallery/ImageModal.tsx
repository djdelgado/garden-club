"use client";

import { useState } from "react";
import { Modal, Box, IconButton, Typography, Button, Alert } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import { GardenImage } from "@/types/image";
import Image from "next/image";
import { IMAGES_BASE_URL } from "@/lib/constants";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ImageService } from "@/services/imageService";

interface ImageModalProps {
  image: GardenImage;
  onClose: () => void;
  onDeleted?: (imageId: string) => void;
}

export function ImageModal({ image, onClose, onDeleted }: ImageModalProps) {
  const { isAdmin } = useIsAdmin();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await ImageService.deleteImage(image.imageId);
      onDeleted?.(image.imageId);
      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to delete image. Please try again.");
      setDeleting(false);
    }
  };

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

        <Box sx={{ p: 2 }}>
          <Image
            src={image.imageUrl ?? `${IMAGES_BASE_URL}/${image.s3Key}`}
            alt={image.fileName}
            width={1000}
            height={1000}
            style={{
              maxWidth: "100%",
              height: "auto",
              borderRadius: "4px",
            }}
          />
          <Typography
            variant="body2"
            sx={{ color: "white", mt: 1, textAlign: "center" }}
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
