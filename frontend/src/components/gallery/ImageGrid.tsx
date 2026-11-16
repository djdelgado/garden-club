"use client";

import { Box, ImageList, ImageListItem } from "@mui/material";
import { GardenImage } from "@/types/image";
import Image from "next/image";
import { useState } from "react";
import { ImageModal } from "./ImageModal";
import { IMAGES_BASE_URL } from "@/lib/constants";
import { useGalleryColumns } from "@/hooks/useGalleryColumns";

interface ImageGridProps {
  images: GardenImage[];
}

export function imageSrc(image: GardenImage): string {
  return image.imageUrl ?? `${IMAGES_BASE_URL}/${image.s3Key}`;
}

export function ImageGrid({ images }: ImageGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const cols = useGalleryColumns();

  if (images.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <p>No images in this album yet.</p>
      </Box>
    );
  }

  return (
    <>
      <ImageList cols={cols} gap={8}>
        {images.map((image, index) => (
          <ImageListItem
            key={image.imageId}
            onClick={() => setSelectedIndex(index)}
            sx={{ cursor: "pointer" }}
          >
            {/* Fixed-ratio box keeps layout stable while the image loads (no CLS). */}
            <Box
              sx={{
                position: "relative",
                width: "100%",
                aspectRatio: "1",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <Image
                src={imageSrc(image)}
                alt={image.fileName}
                fill
                sizes={`${Math.ceil(100 / cols)}vw`}
                style={{ objectFit: "cover" }}
              />
            </Box>
          </ImageListItem>
        ))}
      </ImageList>
      {selectedIndex !== null && (
        <ImageModal
          images={images}
          index={selectedIndex}
          onNavigate={setSelectedIndex}
          onClose={() => setSelectedIndex(null)}
        />
      )}
    </>
  );
}
