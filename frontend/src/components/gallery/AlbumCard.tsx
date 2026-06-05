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
        "&:hover": { boxShadow: 6 },
      }}
    >
      <CardActionArea>
      {folder.thumbnailUrl ? (
        <Box sx={{ position: "relative", height: 200 }}>
          <CardMedia
            component="img"
            height={200}
            image={folder.thumbnailUrl}
            alt={folder.folderName}
            sx={{ objectFit: "cover" }}
          />
        </Box>
      ) : (
        <Box
          sx={{
            height: 200,
            bgcolor: "primary.light",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PhotoLibraryIcon sx={{ fontSize: 64, color: "primary.main" }} />
        </Box>
      )}
      <CardContent>
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
