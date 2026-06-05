"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Container,
  Typography,
  Alert,
  Fab,
  ImageList,
  ImageListItem,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useRouter } from "next/navigation";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ImageFolder } from "@/types/gallery";
import { AlbumCard } from "@/components/gallery/AlbumCard";
import { CreateAlbumDialog } from "@/components/gallery/CreateAlbumDialog";
import { ImageService } from "@/services/imageService";

export default function GalleryPage() {
  const router = useRouter();
  const { isAdmin } = useIsAdmin();
  const [folders, setFolders] = useState<ImageFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      setLoading(true);
      const folders = await ImageService.getImageFolders();
      setFolders(folders);
    } catch (err) {
      setError("Failed to load albums");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography
            sx={{
              fontSize: "0.75rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "primary.main",
              mb: 0.5,
            }}
          >
            Memories
          </Typography>
          <Typography variant="h2">Photo Gallery</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 480, mt: 0.5 }}>
            Browse albums from past events and gatherings.
          </Typography>
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
        ) : folders?.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="body1" color="text.secondary">
              No albums yet
            </Typography>
          </Box>
        ) : (
          <ImageList cols={3} gap={16}>
            {folders.map((folder) => (
              <ImageListItem key={folder.folderName}>
                <AlbumCard
                  folder={folder}
                  onRefresh={loadFolders}
                  onClick={() =>
                    router.push(
                      `/gallery/${encodeURIComponent(folder.folderName)}`
                    )
                  }
                />
              </ImageListItem>
            ))}
          </ImageList>
        )}

        <Box
          sx={{
            mt: 4,
            border: "2px dashed #b8d4be",
            borderRadius: 3,
            p: 4,
            textAlign: "center",
          }}
        >
          <Typography variant="h6" gutterBottom>
            Share Your Garden
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Members can upload photos from recent events
          </Typography>
          {isAdmin && (
            <Button variant="contained" sx={{ mt: 2 }}>
              Upload Photos
            </Button>
          )}
        </Box>

        {isAdmin && (
          <>
            <Fab
              color="primary"
              aria-label="add album"
              onClick={() => setOpenDialog(true)}
              sx={{ position: "fixed", bottom: 16, right: 16 }}
            >
              <AddIcon />
            </Fab>

            <CreateAlbumDialog
              open={openDialog}
              onClose={() => setOpenDialog(false)}
              onAlbumChanged={() => {
                setOpenDialog(false);
                loadFolders();
              }}
            />
          </>
        )}
      </Box>
    </Container>
  );
}
