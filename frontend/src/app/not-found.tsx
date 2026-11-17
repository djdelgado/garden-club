"use client";

import { Box, Button, Container, Typography } from "@mui/material";

const LINKS = [
  { label: "Home", href: "/home" },
  { label: "Events", href: "/events" },
  { label: "Gallery", href: "/gallery" },
];

export default function NotFound() {
  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          py: 8,
        }}
      >
        <Typography
          sx={{
            fontSize: "0.75rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "primary.main",
            mb: 0.5,
          }}
        >
          Page Not Found
        </Typography>
        <Typography variant="h1" sx={{ fontSize: "clamp(3rem, 10vw, 5rem)", mb: 1 }}>
          404
        </Typography>
        <Typography variant="h3" sx={{ fontStyle: "italic", mb: 2 }}>
          This path has grown over
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          {"The page you're looking for doesn't exist or may have been moved."}
        </Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
          {LINKS.map((link) => (
            <Button
              key={link.href}
              href={link.href}
              variant={link.href === "/home" ? "contained" : "outlined"}
            >
              {link.label}
            </Button>
          ))}
        </Box>
      </Box>
    </Container>
  );
}
