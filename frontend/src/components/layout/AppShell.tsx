"use client";

import { Box } from "@mui/material";
import { TopNav } from "./TopNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", bgcolor: "background.default" }}>
      <TopNav />
      <Box component="main" sx={{ flex: 1, maxWidth: 960, mx: "auto", width: "100%", px: 3, pb: 6 }}>
        {children}
      </Box>
    </Box>
  );
}
