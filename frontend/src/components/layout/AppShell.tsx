"use client";

import { Box } from "@mui/material";
import { SideNav } from "./SideNav";

const DRAWER_WIDTH = 240;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <SideNav />
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          backgroundColor: "#f5f5f5",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
