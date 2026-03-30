"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { GardenImage } from "@/types/image";
import { ImageGrid } from "@/components/gallery/ImageGrid";

export default function AlbumDetailPage() {
  const params = useParams();
  const router = useRouter();
  const folderName = decodeURIComponent(params.folderName as string);

  const [images, setImages] = useState<GardenImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadImages = async () => {
      try {
        setLoading(true);
        const data = await apiGet<GardenImage[]>(
          `/images?folderName=${encodeURIComponent(folderName)}`
        );
        setImages(data);
      } catch (err) {
        setError("Failed to load images");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadImages();
  }, [folderName]);

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <IconButton onClick={() => router.push("/gallery")} aria-label="back">
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
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <ImageGrid images={images} />
        )}
      </Box>
    </Container>
  );
}
