"use client";

import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Chip,
} from "@mui/material";
import { Event } from "@/types/event";
import Image from "next/image";

interface EventFolderProps {
  event: Event;
  imageCount: number;
  onClick: () => void;
}

export function EventFolder({ event, imageCount, onClick }: EventFolderProps) {
  const headerImage = event.headerImageKey
    ? `https://s3.localhost.localstack.cloud:4566/garden-club-images/${event.headerImageKey}`
    : "/default-event-banner.jpg";

  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: "pointer",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <CardMedia sx={{ height: 200, position: "relative" }}>
        <Image
          src={headerImage}
          alt={event.title}
          fill
          style={{ objectFit: "cover" }}
        />
      </CardMedia>
      <CardContent sx={{ flex: 1 }}>
        <Typography variant="h6" gutterBottom>
          {event.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          {event.description.substring(0, 100)}...
        </Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Chip
            label={`${imageCount} photos`}
            size="small"
            color="primary"
            variant="outlined"
          />
          <Typography variant="caption" color="text.secondary">
            {new Date(event.startTime).toLocaleDateString()}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
