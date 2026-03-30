"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Alert,
  Fab,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { apiGet } from "@/lib/api";
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
      const data = await apiGet<Event[]>("/events");
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
        <Typography variant="h2" gutterBottom>
          Events
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mt: 3 }}>
          <EventList
            events={events}
            loading={loading}
            onEventClick={handleEventClick}
          />
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
