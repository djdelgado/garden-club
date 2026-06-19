"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Container,
  Typography,
  Alert,
  Fab,
  Grid,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useRouter } from "next/navigation";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { ImageFolder } from "@/types/gallery";
import { AlbumCard } from "@/components/gallery/AlbumCard";
import { AlbumCardSkeleton } from "@/components/common/AlbumCardSkeleton";
import { CreateAlbumDialog } from "@/components/gallery/CreateAlbumDialog";
import { ImageService } from "@/services/imageService";

export default function GalleryPage() {
  const router = useRouter();
  const { isAdmin } = useIsAdmin();
  const [folders, setFolders] = useState<ImageFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const showSkeleton = useDelayedFlag(loading);

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
          <Typography variant="h3" sx={{ fontStyle: "italic" }}>Photo Gallery</Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Grid container spacing={2}>
            {showSkeleton &&
              Array.from({ length: 6 }).map((_, index) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                  <AlbumCardSkeleton />
                </Grid>
              ))}
          </Grid>
        ) : folders?.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="body1" color="text.secondary">
              No albums yet
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {folders.map((folder) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={folder.folderName}>
                <AlbumCard
                  folder={folder}
                  onRefresh={loadFolders}
                  onClick={() =>
                    router.push(
                      `/gallery/${encodeURIComponent(folder.folderName)}`
                    )
                  }
                />
              </Grid>
            ))}
          </Grid>
        )}

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
