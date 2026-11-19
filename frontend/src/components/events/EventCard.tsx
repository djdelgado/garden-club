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
        data-testid="event-date"
        sx={{
          width: { xs: 64, sm: 90 },
          minWidth: { xs: 64, sm: 90 },
          flexShrink: 0,
          bgcolor: "primary.main",
          // With a banner, show it behind the date under a green wash so the
          // white date text stays readable on any photo.
          ...(event.headerImageUrl && {
            backgroundImage: `linear-gradient(rgba(45,74,50,0.55), rgba(45,74,50,0.55)), url("${event.headerImageUrl}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }),
          color: "primary.contrastText",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
          py: 1.5,
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
      {/* Text + RSVP: side by side from `sm` up, stacked on phones so the
          title gets the full card width. */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
        }}
      >
        <CardContent sx={{ flex: 1, minWidth: 0, py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
            {event.title}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
            <AccessTimeIcon sx={{ fontSize: 13, color: "text.secondary", flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary">
              {formatTime(startDate)} – {formatTime(endDate)}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {event.description.substring(0, 80)}
            {event.description.length > 80 ? "..." : ""}
          </Typography>
        </CardContent>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "row", sm: "column" },
            alignItems: "center",
            justifyContent: { xs: "flex-start", sm: "center" },
            gap: { xs: 1.5, sm: 0.75 },
            px: { xs: 2, sm: 0 },
            pb: { xs: 1.5, sm: 0 },
            pr: { sm: 2 },
            pl: { sm: 1 },
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
      </Box>
    </Card>
  );
}
