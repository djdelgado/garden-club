"use client";

import { useState, useEffect } from "react";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Avatar,
  Button,
  Typography,
  Divider,
} from "@mui/material";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "aws-amplify/auth";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import EventIcon from "@mui/icons-material/Event";
import { useAuth } from "@/hooks/useAuth";

const DRAWER_WIDTH = 240;

export function SideNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [initials, setInitials] = useState("");

  useEffect(() => {
    if (user) {
      const parts = (user.username || "").split(" ");
      const init =
        parts
          .map((p) => p[0])
          .join("")
          .toUpperCase() || "U";
      setInitials(init);
    }
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/signin");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const navItems = [
    { label: "Gallery", icon: <PhotoLibraryIcon />, href: "/gallery" },
    { label: "Events", icon: <EventIcon />, href: "/events" },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "primary.main" }}>
          🌸 Garden Club
        </Typography>
      </Box>

      <List sx={{ flex: 1 }}>
        {navItems.map((item) => (
          <ListItem key={item.href} disablePadding>
            <ListItemButton
              href={item.href}
              selected={pathname.startsWith(item.href)}
              sx={{
                "&.Mui-selected": {
                  backgroundColor: "primary.light",
                  color: "white",
                  "& .MuiListItemIcon-root": {
                    color: "white",
                  },
                },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />

      <Box sx={{ p: 2 }}>
        {!loading && user && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36 }}>
              {initials}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {user.username}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}
              >
                {user.email}
              </Typography>
            </Box>
          </Box>
        )}
        <Button
          variant="outlined"
          color="primary"
          size="small"
          fullWidth
          onClick={handleSignOut}
        >
          Sign Out
        </Button>
      </Box>
    </Drawer>
  );
}
