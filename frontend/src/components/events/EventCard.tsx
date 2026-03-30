"use client";

import { Card, CardContent, Typography, Box } from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
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

  const formatTime = (date: Date) =>
    date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: "pointer",
        display: "flex",
        flexDirection: "row",
        height: 110,
        "&:hover": { boxShadow: 4 },
      }}
    >
      <Box
        sx={{
          width: 80,
          minWidth: 80,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1 }}>
          {month.toUpperCase()}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>
          {day}
        </Typography>
        <CalendarTodayIcon sx={{ fontSize: 14 }} />
      </Box>
      <CardContent sx={{ flex: 1, py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="h6" noWrap>
          {event.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {event.description.substring(0, 80)}
          {event.description.length > 80 ? "..." : ""}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatTime(startDate)} – {formatTime(endDate)}
        </Typography>
      </CardContent>
    </Card>
  );
}
