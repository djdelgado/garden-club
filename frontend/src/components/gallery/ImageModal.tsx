"use client";

import { Modal, Box, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { GardenImage } from "@/types/image";
import Image from "next/image";
import { IMAGES_BASE_URL } from "@/lib/constants";

interface ImageModalProps {
  image: GardenImage;
  onClose: () => void;
}

export function ImageModal({ image, onClose }: ImageModalProps) {
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
            src={`${IMAGES_BASE_URL}/${image.s3Key}`}
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
        </Box>
      </Box>
    </Modal>
  );
}
