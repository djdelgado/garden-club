"use client";

import { Grid, Box, CircularProgress } from "@mui/material";
import { Event } from "@/types/event";
import { EventCard } from "./EventCard";

interface EventListProps {
  events: Event[];
  loading?: boolean;
  onEventClick: (eventId: string) => void;
}

export function EventList({
  events,
  loading = false,
  onEventClick,
}: EventListProps) {
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      {events.map((event) => (
        <Grid item xs={12} sm={6} md={4} key={event.eventId}>
          <EventCard
            event={event}
            onClick={() => onEventClick(event.eventId)}
          />
        </Grid>
      ))}
    </Grid>
  );
}
