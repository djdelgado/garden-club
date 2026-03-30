"use client";

import { Box, ImageList, ImageListItem } from "@mui/material";
import { GardenImage } from "@/types/image";
import Image from "next/image";
import { useState } from "react";
import { ImageModal } from "./ImageModal";
import { IMAGES_BASE_URL } from "@/lib/constants";

interface ImageGridProps {
  images: GardenImage[];
}

export function ImageGrid({ images }: ImageGridProps) {
  const [selectedImage, setSelectedImage] = useState<GardenImage | null>(null);

  if (images.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <p>No images in this album yet.</p>
      </Box>
    );
  }

  return (
    <>
      <ImageList cols={3} gap={8}>
        {images.map((image) => (
          <ImageListItem
            key={image.imageId}
            onClick={() => setSelectedImage(image)}
            sx={{ cursor: "pointer" }}
          >
            <Image
              src={`${IMAGES_BASE_URL}/${image.s3Key}`}
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
