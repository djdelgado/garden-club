"use client";

import { Box, Container, Typography, Button } from "@mui/material";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 8 }}>
        <Typography variant="h1" gutterBottom>
          Welcome to Garden Club
        </Typography>
        <Typography variant="h6" color="text.secondary" paragraph>
          Join our community of garden enthusiasts. Browse upcoming events and
          explore our photo gallery.
        </Typography>

        <Box sx={{ display: "flex", gap: 2, mt: 4 }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => router.push("/events")}
          >
            View Events
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => router.push("/gallery")}
          >
            Browse Gallery
          </Button>
        </Box>
      </Box>
    </Container>
  );
}
