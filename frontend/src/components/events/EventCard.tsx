"use client";

import { Card, CardContent, Typography, Box, Button } from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { Event } from "@/types/event";

interface EventCardProps {
  event: Event;
  onClick: () => void;
}

export function EventCard({ event, onClick }: EventCardProps) {
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);

  const month = startDate.toLocaleString("en-US", { month: "short" });
  const day = startDate.getDate();
  const year = startDate.getFullYear();

  const formatTime = (date: Date) =>
    date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: "pointer",
        display: "flex",
        flexDirection: "row",
        border: "1px solid #dcecd2",
        borderRadius: 3,
        "&:hover": { boxShadow: 4 },
      }}
    >
      <Box
        sx={{
          width: 90,
          minWidth: 90,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
          borderRadius: "inherit",
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1 }}>
          {month.toUpperCase()}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>
          {day}
        </Typography>
        <Typography variant="caption" sx={{ lineHeight: 1, opacity: 0.85 }}>
          {year}
        </Typography>
      </Box>
      <CardContent sx={{ flex: 1, py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="h6" noWrap>
          {event.title}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
          <AccessTimeIcon sx={{ fontSize: 13, color: "text.secondary" }} />
          <Typography variant="caption" color="text.secondary">
            {formatTime(startDate)} – {formatTime(endDate)}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
          {event.description.substring(0, 80)}
          {event.description.length > 80 ? "..." : ""}
        </Typography>
      </CardContent>
      <Box sx={{ display: "flex", alignItems: "center", pr: 2 }}>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          onClick={(e) => e.stopPropagation()}
        >
          RSVP
        </Button>
      </Box>
    </Card>
  );
}
