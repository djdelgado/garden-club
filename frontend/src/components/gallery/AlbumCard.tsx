"use client";

import { Card, CardContent, CardMedia, Typography, Box, CardActionArea, CardActions, IconButton } from "@mui/material";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import EditIcon from '@mui/icons-material/Edit';
import { ImageFolder } from "@/types/gallery";
import { useState } from "react";
import { CreateAlbumDialog } from "./CreateAlbumDialog";

interface AlbumCardProps {
  folder: ImageFolder;
  onClick: () => void;
  onRefresh: () => void;
}

export function AlbumCard({ folder, onClick, onRefresh }: AlbumCardProps) {
  const [openDialog, setOpenDialog] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  const editClicked = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEdit(true);
    setOpenDialog(true);
  };

  return (
    <>
    <Card
      onClick={onClick}
      sx={{
        cursor: "pointer",
        borderRadius: 3,
        boxShadow: 2,
        height: 300,
        display: "flex",
        flexDirection: "column",
        "&:hover": { boxShadow: 6 },
      }}
    >
      <CardActionArea sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch" }}>
      {folder.thumbnailUrl ? (
          <CardMedia
            component="img"
            image={folder.thumbnailUrl}
            alt={folder.folderName}
            sx={{ objectFit: "cover" , height: 200 }}
          />
      ) : (
        <Box
          sx={{
            bgcolor: "primary.light",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PhotoLibraryIcon sx={{ fontSize: 64, color: "primary.main" }} />
        </Box>
      )}
      <CardContent sx={{ flex: 1 }}>
        <Typography variant="subtitle1" noWrap>
          {folder.folderName}
        </Typography>
        <Typography variant="caption" color="primary">
          {folder.imageCount} {folder.imageCount === 1 ? "photo" : "photos"}
        </Typography>
      </CardContent>
      </CardActionArea>
      <CardActions>
        <IconButton aria-label="edit" size="small" onClick={editClicked}>
          <EditIcon fontSize="inherit" />
        </IconButton>
      </CardActions>
    </Card>
    { openDialog && (
      <CreateAlbumDialog
        open={openDialog}
        isEdit={isEdit}
        folderData={{ folderName: folder.folderName }}
        onClose={() => setOpenDialog(false)}
        onAlbumChanged={() => { setOpenDialog(false); onRefresh(); }}
      />
    )}
    </>
  );
}
