"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import Image from "next/image";
import { Event } from "@/types/event";
import { IMAGES_BASE_URL } from "@/lib/constants";

interface EventDetailModalProps {
  event: Event | null;
  onClose: () => void;
}

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  if (!event) return null;

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);

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
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
