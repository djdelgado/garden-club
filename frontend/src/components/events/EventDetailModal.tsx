"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Stack,
} from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import Image from "next/image";
import { Event, RsvpSummary } from "@/types/event";
import { EventService } from "@/services/eventService";
import { IMAGES_BASE_URL } from "@/lib/constants";

interface EventDetailModalProps {
  event: Event | null;
  onClose: () => void;
  onRsvpChange?: (eventId: string, summary: RsvpSummary) => void;
}

export function EventDetailModal({ event, onClose, onRsvpChange }: EventDetailModalProps) {
  const [pending, setPending] = useState(false);

  if (!event) return null;

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const isPast = endDate.getTime() < Date.now();

  const handleRsvpToggle = async () => {
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

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const formatTime = (date: Date) =>
    date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <Dialog open={!!event} onClose={onClose} maxWidth="md" fullWidth>
      {event.headerImageKey && (
        <Box sx={{ position: "relative", width: "100%", height: 280 }}>
          <Image
            src={`${IMAGES_BASE_URL}/${event.headerImageKey}`}
            alt={event.title}
            fill
            style={{ objectFit: "cover" }}
          />
        </Box>
      )}
      <DialogTitle>{event.title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CalendarTodayIcon fontSize="small" color="action" />
            <Typography variant="body2">{formatDate(startDate)}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <AccessTimeIcon fontSize="small" color="action" />
            <Typography variant="body2">
              {formatTime(startDate)} – {formatTime(endDate)}
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
            {event.description}
          </Typography>

          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <PeopleAltOutlinedIcon fontSize="small" color="action" />
              <Typography variant="subtitle2">
                {event.rsvpCount === 1
                  ? "1 person attending"
                  : `${event.rsvpCount} people attending`}
              </Typography>
            </Box>
            {event.attendees && event.attendees.length > 0 && (
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                {event.attendees.map((name) => (
                  <Chip key={name} label={name} size="small" variant="outlined" />
                ))}
              </Stack>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          variant={event.isAttending ? "contained" : "outlined"}
          color="primary"
          disabled={pending || isPast}
          onClick={handleRsvpToggle}
        >
          {isPast ? "Event ended" : event.isAttending ? "Going" : "I'm going"}
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
