"use client";

import { Card, CardContent, CardMedia, Typography, Box, CardActionArea, CardActions, Button, IconButton } from "@mui/material";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import EditIcon from '@mui/icons-material/Edit';
import { ImageFolder } from "@/types/gallery";
import { useState } from "react";
import { CreateAlbumDialog } from "./CreateAlbumDialog";
import { DeleteAlbumBtn } from "./DeleteAlbumBtn";

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
        "&:hover": { boxShadow: 4 },
      }}
    >
      <CardActionArea>
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
      </CardActionArea>
      <CardActions>
        <IconButton aria-label="delete" size="small" onClick={editClicked}>
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
