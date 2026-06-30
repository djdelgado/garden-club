"use client";

import { Grid } from "@mui/material";
import { Event } from "@/types/event";
import { EventCard } from "./EventCard";
import { EventCardSkeleton } from "@/components/common/EventCardSkeleton";

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
      <Grid container spacing={3}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Grid size={12} key={index}>
            <EventCardSkeleton />
          </Grid>
        ))}
      </Grid>
    );
  }

  return (
    <Grid container spacing={3}>
      {events && events.map((event) => (
        <Grid size={12} key={event.eventId}>
          <EventCard
            event={event}
            onClick={() => onEventClick(event.eventId)}
          />
        </Grid>
      ))}
    </Grid>
  );
}
