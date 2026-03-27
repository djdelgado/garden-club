"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Grid,
  Dialog,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Fab,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { apiGet, apiPost } from "@/lib/api";
import { Event } from "@/types/event";
import { EventFolder } from "@/components/gallery/EventFolder";
import { v4 as uuidv4 } from "uuid";

export default function GalleryPage() {
  const { isAdmin } = useIsAdmin();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [albumName, setAlbumName] = useState("");

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

  const handleCreateEvent = async () => {
    if (!albumName.trim()) return;

    try {
      setCreateLoading(true);
      const now = new Date();
      const startTime = now.toISOString();
      const endTime = new Date(now.getTime() + 3600000).toISOString();

      const newEvent = {
        eventId: uuidv4(),
        title: albumName,
        description: `Photo gallery: ${albumName}`,
        startTime,
        endTime,
      };

      await apiPost("/events", newEvent);
      await loadEvents();
      setOpenCreateDialog(false);
      setAlbumName("");
    } catch (err) {
      setError("Failed to create event");
      console.error(err);
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h2" gutterBottom>
          Photo Gallery
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3} sx={{ mt: 1 }}>
          {events.map((event) => (
            <Grid item xs={12} sm={6} md={4} key={event.eventId}>
              <EventFolder
                event={event}
                imageCount={0}
                onClick={() => {
                  // Navigate to event gallery detail
                }}
              />
            </Grid>
          ))}
        </Grid>

        {isAdmin && (
          <>
            <Fab
              color="primary"
              aria-label="add"
              onClick={() => setOpenCreateDialog(true)}
              sx={{
                position: "fixed",
                bottom: 16,
                right: 16,
              }}
            >
              <AddIcon />
            </Fab>

            <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)}>
              <Box sx={{ p: 3, minWidth: 400 }}>
                <Typography variant="h6" gutterBottom>
                  Create New Album
                </Typography>
                <TextField
                  fullWidth
                  label="Album Name"
                  value={albumName}
                  onChange={(e) => setAlbumName(e.target.value)}
                  disabled={createLoading}
                  sx={{ mb: 2 }}
                />
                <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                  <Button
                    onClick={() => setOpenCreateDialog(false)}
                    disabled={createLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleCreateEvent}
                    disabled={createLoading || !albumName.trim()}
                  >
                    {createLoading ? <CircularProgress size={20} /> : "Create"}
                  </Button>
                </Box>
              </Box>
            </Dialog>
          </>
        )}
      </Box>
    </Container>
  );
}
