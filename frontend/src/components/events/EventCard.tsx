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

interface EventCardProps {
  event: Event;
  onClick: () => void;
}

export function EventCard({ event, onClick }: EventCardProps) {
  const headerImage = event.headerImageKey
    ? `https://s3.localhost.localstack.cloud:4566/garden-club-images/${event.headerImageKey}`
    : "/default-event-banner.jpg";

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);

  const formatTime = (date: Date) => {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
          {event.description.substring(0, 100)}
          {event.description.length > 100 ? "..." : ""}
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Chip
            label={formatTime(startDate)}
            size="small"
            color="primary"
            variant="outlined"
          />
          <Chip
            label={`Ends: ${formatTime(endDate)}`}
            size="small"
            variant="outlined"
          />
        </Box>
      </CardContent>
    </Card>
  );
}
