"use client";

import { Card, CardContent, CardMedia, Typography, Box } from "@mui/material";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import { ImageFolder } from "@/types/gallery";

interface AlbumCardProps {
  folder: ImageFolder;
  onClick: () => void;
}

export function AlbumCard({ folder, onClick }: AlbumCardProps) {
  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: "pointer",
        "&:hover": { boxShadow: 4 },
      }}
    >
      {folder.thumbnailUrl ? (
        <CardMedia
          component="img"
          height={200}
          image={folder.thumbnailUrl}
          alt={folder.folderName}
          sx={{ objectFit: "cover" }}
        />
      ) : (
        <Box
          sx={{
            height: 200,
            bgcolor: "grey.200",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PhotoLibraryIcon sx={{ fontSize: 64, color: "grey.400" }} />
        </Box>
      )}
      <CardContent>
        <Typography variant="h6" noWrap>
          {folder.folderName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {folder.imageCount} {folder.imageCount === 1 ? "photo" : "photos"}
        </Typography>
      </CardContent>
    </Card>
  );
}
