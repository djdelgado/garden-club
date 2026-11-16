"use client";

import { useState, useEffect } from "react";
import { Box, Typography, Button, Alert, Stack } from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { useRouter } from "next/navigation";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { EventService } from "@/services/eventService";
import { Event } from "@/types/event";
import { EventDetailModal } from "@/components/events/EventDetailModal";
import { EventCardSkeleton } from "@/components/common/EventCardSkeleton";

const MAX_EVENTS = 3;

/**
 * Amber CTA strip on the home page showing the next few upcoming events.
 * Fetches events from the API (start-of-day onward, matching the events page),
 * renders a compact list, and opens an `EventDetailModal` on click.
 */
export function UpcomingEventsStrip() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const showSkeleton = useDelayedFlag(loading);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const data = await EventService.getEvents(startOfDay.toISOString());
        setEvents(data.slice(0, MAX_EVENTS));
      } catch (err) {
        setError("Failed to load upcoming events");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  const formatTime = (date: Date) =>
    date.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  return (
    <Box
      sx={{
        background: "linear-gradient(135deg, #fef8ee, #fdf0d5)",
        border: "1px solid #e8d9bb",
        borderRadius: 3,
        px: { xs: 3, md: 4 },
        py: 3,
        mb: 4,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          mb: 2,
        }}
      >
        <Typography
          sx={{ fontSize: "1.15rem", fontWeight: 700, color: "#7c5c2a" }}
        >
          🌻 Upcoming Events
        </Typography>
        <Button
          variant="contained"
          onClick={() => router.push("/events")}
          sx={{ bgcolor: "warning.main", fontWeight: 600 }}
        >
          See All Events →
        </Button>
      </Box>

      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : loading ? (
        showSkeleton && (
          <Stack spacing={1}>
            {Array.from({ length: MAX_EVENTS }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </Stack>
        )
      ) : events.length === 0 ? (
        <Typography sx={{ fontSize: "0.875rem", color: "#9a7a4a" }}>
          No upcoming events — check back soon
        </Typography>
      ) : (
        <Stack spacing={1}>
          {events.map((event) => {
            const startDate = new Date(event.startTime);
            return (
              <Box
                key={event.eventId}
                onClick={() => setSelectedEvent(event)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  cursor: "pointer",
                  bgcolor: "rgba(255,255,255,0.5)",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.85)" },
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 700,
                    color: "#7c5c2a",
                    minWidth: 56,
                    fontSize: "0.9rem",
                  }}
                >
                  {formatDate(startDate)}
                </Typography>
                <Typography
                  sx={{
                    flex: 1,
                    fontWeight: 600,
                    color: "#5c4a2a",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {event.title}
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    color: "#9a7a4a",
                  }}
                >
                  <AccessTimeIcon sx={{ fontSize: 14 }} />
                  <Typography sx={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                    {formatTime(startDate)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}

      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </Box>
  );
}
