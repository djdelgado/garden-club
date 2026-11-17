"use client";

import { useState } from "react";
import { Card, CardContent, Typography, Box, Button } from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import { Event, RsvpSummary } from "@/types/event";
import { EventService } from "@/services/eventService";

interface EventCardProps {
  event: Event;
  onClick: () => void;
  onRsvpChange?: (eventId: string, summary: RsvpSummary) => void;
}

export function EventCard({ event, onClick, onRsvpChange }: EventCardProps) {
  const [pending, setPending] = useState(false);
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const isPast = endDate.getTime() < Date.now();

  const handleRsvpToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pending || isPast) return;
    setPending(true);
    try {
      const summary = event.isAttending
        ? await EventService.unrsvp(event.eventId)
        : await EventService.rsvp(event.eventId);
      onRsvpChange?.(event.eventId, summary);
    } catch (err) {
      console.error("Failed to update RSVP", err);
    } finally {
      setPending(false);
    }
  };

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
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.75,
          pr: 2,
          pl: 1,
        }}
      >
        <Button
          variant={event.isAttending ? "contained" : "outlined"}
          color="primary"
          size="small"
          disabled={pending || isPast}
          onClick={handleRsvpToggle}
          sx={{ whiteSpace: "nowrap", minWidth: 96 }}
        >
          {isPast ? "Ended" : event.isAttending ? "Going" : "I'm going"}
        </Button>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <PeopleAltOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
          <Typography variant="caption" color="text.secondary">
            {event.rsvpCount}
          </Typography>
        </Box>
      </Box>
    </Card>
  );
}
