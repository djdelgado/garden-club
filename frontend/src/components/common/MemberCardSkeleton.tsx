"use client";

import { Box, Card, CardContent, Skeleton } from "@mui/material";

/** Skeleton placeholder mirroring the layout of `MemberCard`. */
export function MemberCardSkeleton() {
  return (
    <Card sx={{ borderRadius: 3, boxShadow: 2, height: "100%" }}>
      <CardContent sx={{ display: "flex", gap: 2 }}>
        <Skeleton variant="circular" width={56} height={56} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" height={28} />
          <Skeleton variant="text" width="80%" height={20} />
          <Skeleton variant="text" width="45%" height={20} />
          <Skeleton variant="text" width="70%" height={20} />
        </Box>
      </CardContent>
    </Card>
  );
}
