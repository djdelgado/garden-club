"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Alert,
  Fab,
  Grid2,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useRouter } from "next/navigation";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { apiGet } from "@/lib/api";
import { ImageFolder } from "@/types/gallery";
import { AlbumCard } from "@/components/gallery/AlbumCard";
import { CreateAlbumDialog } from "@/components/gallery/CreateAlbumDialog";

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
      const data = await apiGet<{ folders: ImageFolder[] }>("/images/folders");
      setFolders(data.folders);
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
        <Typography variant="h2" gutterBottom>
          Gallery
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : folders.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="body1" color="text.secondary">
              No albums yet
            </Typography>
          </Box>
        ) : (
          <Grid2 container spacing={3} sx={{ mt: 1 }}>
            {folders.map((folder) => (
              <Grid2 size={{ xs: 12, sm: 6, md: 4 }} key={folder.folderName}>
                <AlbumCard
                  folder={folder}
                  onClick={() =>
                    router.push(
                      `/gallery/${encodeURIComponent(folder.folderName)}`
                    )
                  }
                />
              </Grid2>
            ))}
          </Grid2>
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
              onAlbumCreated={() => {
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
