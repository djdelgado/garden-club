"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Alert,
  Fab,
  CircularProgress
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { EventService } from "@/services/eventService";
import { Event } from "@/types/event";
import { EventList } from "@/components/events/EventList";
import { CreateEventModal } from "@/components/events/CreateEventModal";
import { EventDetailModal } from "@/components/events/EventDetailModal";

export default function EventsPage() {
  const { isAdmin } = useIsAdmin();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await EventService.getEvents();
      console.log(data)
      setEvents(data);
    } catch (err) {
      setError("Failed to load events");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (eventId: string) => {
    const event = events.find((e) => e.eventId === eventId) ?? null;
    setSelectedEvent(event);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "primary.main", mb: 0.5 }}>
            What&apos;s Growing
          </Typography>
          <Typography variant="h2">Upcoming Events</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 480, mt: 0.5 }}>
            From workshops to social mixers — there&apos;s always something blooming.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mt: 3 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress />
            </Box>
          ) : events.length == 0 ? (
            <Typography variant="body1" color="text.secondary">
              No events yet
            </Typography>
          ) :
            (<EventList
              events={events}
              loading={loading}
              onEventClick={handleEventClick}
            />)
          }
        </Box>

        {isAdmin && (
          <>
            <Fab
              color="primary"
              aria-label="add"
              onClick={() => setOpenCreateModal(true)}
              sx={{
                position: "fixed",
                bottom: 16,
                right: 16,
              }}
            >
              <AddIcon />
            </Fab>

            <CreateEventModal
              open={openCreateModal}
              onClose={() => setOpenCreateModal(false)}
              onEventCreated={() => {
                setOpenCreateModal(false);
                loadEvents();
              }}
            />
          </>
        )}

        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      </Box>
    </Container>
  );
}
