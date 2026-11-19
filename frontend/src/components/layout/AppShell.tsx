"use client";

import { Box } from "@mui/material";
import { TopNav } from "./TopNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", bgcolor: "background.default" }}>
      <TopNav />
      <Box component="main" sx={{
          flex: 1,
          maxWidth: 960,
          mx: "auto",
          width: "100%",
          // Pages wrap their content in a <Container>, which already has its
          // own gutters, so skip the extra padding on phones.
          px: { xs: 0, sm: 3 },
          // Clear the fixed admin "add" FAB so it never covers the last item.
          pb: 12,
        }}>
        {children}
      </Box>
    </Box>
  );
}
