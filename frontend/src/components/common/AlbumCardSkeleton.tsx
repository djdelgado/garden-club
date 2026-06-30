"use client";

import { Card, CardContent, Skeleton } from "@mui/material";

/** Skeleton placeholder mirroring the layout of `AlbumCard`. */
export function AlbumCardSkeleton() {
  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: 2,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Skeleton variant="rectangular" height={200} />
      <CardContent sx={{ flex: 1 }}>
        <Skeleton variant="text" width="70%" height={28} />
        <Skeleton variant="text" width="30%" height={18} />
      </CardContent>
    </Card>
  );
}
