"use client";

import { Skeleton } from "@mui/material";

/** Skeleton placeholder mirroring a tile in `ImageGrid`. */
export function ImageTileSkeleton() {
  return (
    <Skeleton
      variant="rectangular"
      width="100%"
      height="100%"
      sx={{ aspectRatio: "1", borderRadius: "8px" }}
    />
  );
}
