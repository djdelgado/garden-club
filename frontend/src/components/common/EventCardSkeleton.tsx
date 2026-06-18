"use client";

import { Card, Box, Skeleton } from "@mui/material";

/** Skeleton placeholder mirroring the layout of `EventCard`. */
export function EventCardSkeleton() {
  return (
    <Card
      sx={{
        display: "flex",
        flexDirection: "row",
        border: "1px solid #dcecd2",
        borderRadius: 3,
      }}
    >
      <Box
        sx={{
          width: 90,
          minWidth: 90,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
          p: 1.5,
        }}
      >
        <Skeleton variant="text" width={32} height={14} />
        <Skeleton variant="text" width={28} height={28} />
        <Skeleton variant="text" width={32} height={14} />
      </Box>
      <Box sx={{ flex: 1, py: 1.5, px: 2 }}>
        <Skeleton variant="text" width="60%" height={28} />
        <Skeleton variant="text" width="30%" height={18} sx={{ mt: 0.25 }} />
        <Skeleton variant="text" width="80%" height={20} sx={{ mt: 0.5 }} />
      </Box>
    </Card>
  );
}
