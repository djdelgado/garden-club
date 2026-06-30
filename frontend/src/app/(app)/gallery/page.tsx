"use client";

import { Suspense, useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Alert,
  Fab,
  Grid,
  ImageList,
  ImageListItem,
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useRouter, useSearchParams } from "next/navigation";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { ImageFolder } from "@/types/gallery";
import { GardenImage } from "@/types/image";
import { AlbumCard } from "@/components/gallery/AlbumCard";
import { AlbumCardSkeleton } from "@/components/common/AlbumCardSkeleton";
import { CreateAlbumDialog } from "@/components/gallery/CreateAlbumDialog";
import { ImageGrid } from "@/components/gallery/ImageGrid";
import { ImageTileSkeleton } from "@/components/common/ImageTileSkeleton";
import { ImageService } from "@/services/imageService";

function AlbumList() {
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
                      `/gallery?folder=${encodeURIComponent(folder.folderName)}`
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

function AlbumDetail({ folderName }: { folderName: string }) {
  const router = useRouter();
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
  };

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

function GalleryContent() {
  const searchParams = useSearchParams();
  const folder = searchParams.get("folder");

  if (folder) {
    return <AlbumDetail folderName={folder} />;
  }

  return <AlbumList />;
}

export default function GalleryPage() {
  return (
    <Suspense>
      <GalleryContent />
    </Suspense>
  );
}
