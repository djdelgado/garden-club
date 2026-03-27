"use client";

import { Box, ImageList, ImageListItem } from "@mui/material";
import { GardenImage } from "@/types/image";
import Image from "next/image";
import { useState } from "react";
import { ImageModal } from "./ImageModal";

interface ImageGridProps {
  images: GardenImage[];
}

export function ImageGrid({ images }: ImageGridProps) {
  const [selectedImage, setSelectedImage] = useState<GardenImage | null>(null);

  if (images.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <p>No images yet for this event.</p>
      </Box>
    );
  }

  return (
    <>
      <ImageList cols={{ xs: 2, sm: 3, md: 4 }} gap={8}>
        {images.map((image) => (
          <ImageListItem
            key={image.imageId}
            onClick={() => setSelectedImage(image)}
            sx={{ cursor: "pointer" }}
          >
            <Image
              src={`https://s3.localhost.localstack.cloud:4566/garden-club-images/${image.s3Key}`}
              alt={image.fileName}
              width={300}
              height={300}
              style={{
                objectFit: "cover",
                borderRadius: "8px",
              }}
            />
          </ImageListItem>
        ))}
      </ImageList>
      {selectedImage && (
        <ImageModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </>
  );
}
