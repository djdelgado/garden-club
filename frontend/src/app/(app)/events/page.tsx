"use client";

import { Suspense, useMemo, useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Alert,
  Fab,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useRouter, useSearchParams } from "next/navigation";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { EventService } from "@/services/eventService";
import { Event, RsvpSummary } from "@/types/event";
import { EventList } from "@/components/events/EventList";
import { CreateEventModal } from "@/components/events/CreateEventModal";
import { EventDetailModal } from "@/components/events/EventDetailModal";

type EventView = "upcoming" | "past";

function EventsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view: EventView = searchParams.get("view") === "past" ? "past" : "upcoming";

  const { isAdmin } = useIsAdmin();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const showSkeleton = useDelayedFlag(loading);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await EventService.getEvents();
      setEvents(data);
    } catch (err) {
      setError("Failed to load events");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const { upcoming, past } = useMemo(() => {
    const now = new Date().toISOString();
    const upcoming = events
      .filter((e) => e.startTime >= now)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const past = events
      .filter((e) => e.startTime < now)
      .sort((a, b) => b.startTime.localeCompare(a.startTime));
    return { upcoming, past };
  }, [events]);

  const visibleEvents = view === "past" ? past : upcoming;

  const handleEventClick = async (eventId: string) => {
    const event = events.find((e) => e.eventId === eventId) ?? null;
    // Show the modal immediately from the list data, then fetch attendee names.
    setSelectedEvent(event);
    try {
      const detail = await EventService.getEvent(eventId);
      setSelectedEvent((current) =>
        current?.eventId === eventId ? detail : current
      );
    } catch (err) {
      console.error("Failed to load event detail", err);
    }
  };

  // Reconcile RSVP count/state from the server response so it survives reloads.
  const handleRsvpChange = (eventId: string, summary: RsvpSummary) => {
    setEvents((prev) =>
      prev.map((e) => (e.eventId === eventId ? { ...e, ...summary } : e))
    );
    setSelectedEvent((current) =>
      current?.eventId === eventId ? { ...current, ...summary } : current
    );
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(null);
    setEditEvent(event);
  };

  const handleEventDeleted = () => {
    setSelectedEvent(null);
    loadEvents();
  };

  const handleViewChange = (
    _event: React.MouseEvent<HTMLElement>,
    nextView: EventView | null
  ) => {
    if (!nextView) return;
    router.push(nextView === "past" ? "/events?view=past" : "/events");
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Box
          sx={{
            mb: 4,
            display: "flex",
            alignItems: { xs: "flex-start", sm: "flex-end" },
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "primary.main", mb: 0.5 }}>
              What&apos;s Growing
            </Typography>
            <Typography variant="h3" sx={{ fontStyle: "italic" }}>
              {view === "past" ? "Past Events" : "Upcoming Events"}
            </Typography>
          </Box>

          <ToggleButtonGroup
            value={view}
            exclusive
            onChange={handleViewChange}
            size="small"
            color="primary"
            aria-label="event view"
          >
            <ToggleButton value="upcoming" aria-label="upcoming events">
              Upcoming
            </ToggleButton>
            <ToggleButton value="past" aria-label="past events">
              Past
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mt: 3 }}>
          {loading ? (
            <EventList
              events={[]}
              loading={showSkeleton}
              onEventClick={handleEventClick}
            />
          ) : visibleEvents.length == 0 ? (
            <Typography variant="body1" color="text.secondary">
              {view === "past" ? "No past events" : "No upcoming events"}
            </Typography>
          ) :
            (<EventList
              events={visibleEvents}
              onEventClick={handleEventClick}
              onRsvpChange={handleRsvpChange}
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
              onEventSaved={() => {
                setOpenCreateModal(false);
                loadEvents();
              }}
            />

            <CreateEventModal
              open={!!editEvent}
              isEdit
              event={editEvent}
              onClose={() => setEditEvent(null)}
              onEventSaved={() => {
                setEditEvent(null);
                loadEvents();
              }}
            />
          </>
        )}

        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRsvpChange={handleRsvpChange}
          onEdit={handleEditEvent}
          onDeleted={handleEventDeleted}
        />
      </Box>
    </Container>
  );
}

export default function EventsPage() {
  return (
    <Suspense>
      <EventsContent />
    </Suspense>
  );
}
