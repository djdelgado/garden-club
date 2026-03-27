"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Alert,
  Paper,
} from "@mui/material";
import Image from "next/image";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { Event } from "@/types/event";
import { GardenImage } from "@/types/image";
import { ImageGrid } from "@/components/gallery/ImageGrid";
import { UploadButton } from "@/components/gallery/UploadButton";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { isAdmin } = useIsAdmin();
  const [event, setEvent] = useState<Event | null>(null);
  const [images, setImages] = useState<GardenImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      const eventData = await apiGet<Event>(`/events/${eventId}`);
      setEvent(eventData);

      try {
        const imagesData = await apiGet<GardenImage[]>(
          `/images?eventId=${eventId}`
        );
        setImages(imagesData || []);
      } catch (err) {
        console.error("Failed to load images:", err);
      }
    } catch (err) {
      setError("Failed to load event");
      console.error(err);
    } finally {
      setLoading(false);
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

  if (error || !event) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">{error || "Event not found"}</Alert>
        </Box>
      </Container>
    );
  }

  const headerImage = event.headerImageKey
    ? `https://s3.localhost.localstack.cloud:4566/garden-club-images/${event.headerImageKey}`
    : "/default-event-banner.jpg";

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Box sx={{ position: "relative", height: 400, mb: 4, borderRadius: 2, overflow: "hidden" }}>
          <Image
            src={headerImage}
            alt={event.title}
            fill
            style={{ objectFit: "cover" }}
          />
        </Box>

        <Paper sx={{ p: 4, mb: 4 }}>
          <Typography variant="h2" gutterBottom>
            {event.title}
          </Typography>
          <Typography variant="body1" paragraph>
            {event.description}
          </Typography>

          <Box sx={{ display: "flex", gap: 4, mt: 3 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Start Time
              </Typography>
              <Typography variant="body1">
                {new Date(event.startTime).toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                End Time
              </Typography>
              <Typography variant="body1">
                {new Date(event.endTime).toLocaleString()}
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Photos ({images.length})
          </Typography>
          {isAdmin && (
            <UploadButton eventId={eventId} onUploadSuccess={loadEvent} />
          )}
          <ImageGrid images={images} />
        </Box>
      </Box>
    </Container>
  );
}
