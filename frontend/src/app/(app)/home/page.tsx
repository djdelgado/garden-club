"use client";

import {
  Box,
  Card,
  CardContent,
  Container,
  Typography,
} from "@mui/material";
import { UpcomingEventsStrip } from "@/components/events/UpcomingEventsStrip";

const HERO_IMAGE = "/images/english-turn-entrance.jpg";

const FEATURE_CARDS = [
  {
    icon: "🌱",
    title: "Seasonal Calendar",
    body: "Stay on top of what to plant and when with our curated planting guides for Louisiana's climate.",
  },
  {
    icon: "🤝",
    title: "Community",
    body: "Swap seeds, share tips, and make lifelong friends at our regular member gatherings.",
  },
  {
    icon: "📚",
    title: "Workshops",
    body: "Hands-on learning from master gardeners and horticultural specialists throughout the year.",
  },
];

export default function HomePage() {
  return (
    <Box>
      {/* Hero */}
      <Box
        sx={{
          // The English Turn entrance photo under a deep-green wash: dark enough
          // at the top for the headline, lighter at the bottom so the
          // greenery and sign still read through.
          backgroundImage: `linear-gradient(180deg, rgba(29,51,34,0.88) 0%, rgba(29,51,34,0.62) 55%, rgba(29,51,34,0.35) 100%), url(${HERO_IMAGE})`,
          backgroundSize: "cover",
          backgroundPosition: "center 65%",
          backgroundColor: "#2d4a32",
          borderRadius: "0 0 2rem 2rem",
          px: { xs: 2.5, md: 6 },
          py: { xs: 6, md: 10 },
          mb: 3,
          position: "relative",
          overflow: "hidden",
          textAlign: "center",
          color: "#fff",
        }}
      >
        {/* Badge */}
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            background: "rgba(255,255,255,0.16)",
            backdropFilter: "blur(4px)",
            borderRadius: 20,
            px: 2,
            py: 0.5,
            mb: 2,
            maxWidth: "100%",
            fontSize: { xs: "0.7rem", sm: "0.75rem" },
            letterSpacing: { xs: "0.08em", sm: "0.12em" },
            textTransform: "uppercase",
          }}
        >
          🌿 Established 1988 · New Orleans, LA
        </Box>

        <Typography
          variant="h1"
          sx={{
            fontSize: "clamp(1.9rem, 7vw, 3.5rem)",
            fontWeight: 700,
            lineHeight: 1.15,
            mb: 2,
            textShadow: "0 2px 12px rgba(0,0,0,0.35)",
          }}
        >
          Cultivating Community
          <br />
          <Box
            component="span"
            sx={{ fontStyle: "italic", fontWeight: 400, color: "#a8d8b0" }}
          >
            One Garden at a Time
          </Box>
        </Typography>

        <Typography
          sx={{
            fontSize: "1.05rem",
            maxWidth: 480,
            mx: "auto",
            opacity: 0.92,
            lineHeight: 1.7,
            textShadow: "0 1px 8px rgba(0,0,0,0.4)",
          }}
        >
          {"A welcoming society of passionate gardeners sharing knowledge, beauty, and Louisiana's rich horticultural heritage."}
        </Typography>
      </Box>

      <Container maxWidth="lg">
        {/* Upcoming-events CTA strip (wired to the events API) */}
        <UpcomingEventsStrip />

        {/* Feature cards */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
            gap: 2.5,
            mb: 5,
          }}
        >
          {FEATURE_CARDS.map((card) => (
            <Card
              key={card.title}
              sx={{
                border: "1px solid #dcecd2",
                boxShadow: "0 2px 12px rgba(74,124,89,0.06)",
                borderRadius: "1rem",
              }}
            >
              <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
                <Box sx={{ fontSize: "2rem", mb: 1.5 }}>{card.icon}</Box>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: "#2d4a32", mb: 1 }}
                >
                  {card.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "#6a7d6c", lineHeight: 1.65 }}
                >
                  {card.body}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
