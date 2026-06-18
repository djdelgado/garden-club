"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Alert,
  ImageList,
  ImageListItem,
  IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useParams, useRouter } from "next/navigation";
import { GardenImage } from "@/types/image";
import { ImageGrid } from "@/components/gallery/ImageGrid";
import { ImageTileSkeleton } from "@/components/common/ImageTileSkeleton";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { ImageService } from "@/services/imageService";

export default function AlbumDetailPage() {
  const params = useParams();
  const router = useRouter();
  const folderName = decodeURIComponent(params.folderName as string);

  const [images, setImages] = useState<GardenImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const showSkeleton = useDelayedFlag(loading);

  useEffect(() => {
    const loadImages = async () => {
      try {
        setLoading(true);
        const images = await ImageService.getImagesbyFolderName(folderName);
        setImages(images);
      } catch (err) {
        setError("Failed to load images");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadImages();
  }, [folderName]);

  const backClicked = () => {
    return router.push("/gallery");
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <IconButton onClick={backClicked} aria-label="back">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h2">{folderName}</Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <ImageList cols={3} gap={8}>
            {showSkeleton &&
              Array.from({ length: 9 }).map((_, index) => (
                <ImageListItem key={index}>
                  <ImageTileSkeleton />
                </ImageListItem>
              ))}
          </ImageList>
        ) : (
          <ImageGrid images={images} />
        )}
      </Box>
    </Container>
  );
}
