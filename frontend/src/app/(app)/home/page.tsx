"use client";

import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  return (
    <Box>
      {/* Hero */}
      <Box
        sx={{
          background:
            "linear-gradient(135deg, #2d4a32 0%, #4a7c59 60%, #6aab7a 100%)",
          borderRadius: "0 0 2rem 2rem",
          px: { xs: 3, md: 6 },
          py: { xs: 8, md: 10 },
          mb: 6,
          position: "relative",
          overflow: "hidden",
          textAlign: "center",
          color: "#fff",
        }}
      >
        {/* Decorative circles */}
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
            pointerEvents: "none",
          }}
        />
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            bottom: -40,
            left: -40,
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
            pointerEvents: "none",
          }}
        />

        {/* Badge */}
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            background: "rgba(255,255,255,0.12)",
            borderRadius: 20,
            px: 2,
            py: 0.5,
            mb: 2,
            fontSize: "0.75rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          🌿 Established 1947 · New Orleans, LA
        </Box>

        <Typography
          variant="h1"
          sx={{
            fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
            fontWeight: 700,
            lineHeight: 1.15,
            mb: 2,
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
            mb: 4,
            opacity: 0.85,
            lineHeight: 1.7,
          }}
        >
          A welcoming society of passionate gardeners sharing knowledge, beauty,
          and Louisiana's rich horticultural heritage.
        </Typography>

        <Box
          sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}
        >
          <Button
            variant="contained"
            size="large"
            onClick={() => router.push("/events")}
            sx={{
              bgcolor: "#fff",
              color: "#2d4a32",
              fontWeight: 600,
              "&:hover": { bgcolor: "#f0f7f0" },
            }}
          >
            Upcoming Events
          </Button>
          {/* May not be needed until we have a membership system in place */}
          {/* <Button
            variant="outlined"
            size="large"
            sx={{
              color: "#fff",
              borderColor: "rgba(255,255,255,0.5)",
              "&:hover": {
                borderColor: "#fff",
                bgcolor: "rgba(255,255,255,0.08)",
              },
            }}
          >
            Join the Club
          </Button> */}
        </Box>
      </Box>

      <Container maxWidth="lg">
        {/* Feature cards */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
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
              <CardContent sx={{ p: 3.5 }}>
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

        {/* TODO: Amber CTA strip - need to integrate with events api */}
        {/* <Box
          sx={{
            background: "linear-gradient(135deg, #fef8ee, #fdf0d5)",
            border: "1px solid #e8d9bb",
            borderRadius: 3,
            px: { xs: 3, md: 4 },
            py: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
            mb: 4,
          }}
        >
          <Box>
            <Typography
              sx={{
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "#7c5c2a",
                mb: 0.5,
              }}
            >
              🌻 Next Meeting: June 14th
            </Typography>
            <Typography sx={{ fontSize: "0.875rem", color: "#9a7a4a" }}>
              Audubon Park Pavilion · 10:00 AM · All members welcome
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={() => router.push("/events")}
            sx={{ bgcolor: "warning.main", fontWeight: 600 }}
          >
            See All Events →
          </Button>
        </Box> */}
      </Container>
    </Box>
  );
}
