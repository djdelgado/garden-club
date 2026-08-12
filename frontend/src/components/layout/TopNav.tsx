"use client";

import { useState, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  Avatar,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "aws-amplify/auth";
import { useAuth } from "@/hooks/useAuth";
import { clearTokenCache } from "@/lib/api";

const NAV_LINKS = [
  { label: "Home", href: "/home" },
  { label: "Events", href: "/events" },
  { label: "Gallery", href: "/gallery" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [initials, setInitials] = useState("");
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

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
    handleMenuClose();
    try {
      await signOut();
      clearTokenCache();
      router.push("/signin");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <AppBar position="sticky" color="transparent" elevation={0} sx={{ borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
      <Toolbar sx={{ gap: 2, justifyContent: "space-between", flexWrap: "wrap" }}>
        {/* Logo */}
        <Box
          component="a"
          href="/home"
          sx={{ display: "flex", alignItems: "center", gap: 1, textDecoration: "none", color: "inherit", mr: 2 }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="14" cy="14" r="5" fill="#6B8F6B" />
            <ellipse cx="14" cy="6" rx="3" ry="5" fill="#8FAF8F" />
            <ellipse cx="14" cy="22" rx="3" ry="5" fill="#8FAF8F" />
            <ellipse cx="6" cy="14" rx="5" ry="3" fill="#8FAF8F" />
            <ellipse cx="22" cy="14" rx="5" ry="3" fill="#8FAF8F" />
            <ellipse cx="8.5" cy="8.5" rx="3" ry="4.5" fill="#A8C5A8" transform="rotate(-45 8.5 8.5)" />
            <ellipse cx="19.5" cy="8.5" rx="3" ry="4.5" fill="#A8C5A8" transform="rotate(45 19.5 8.5)" />
            <ellipse cx="8.5" cy="19.5" rx="3" ry="4.5" fill="#A8C5A8" transform="rotate(45 8.5 19.5)" />
            <ellipse cx="19.5" cy="19.5" rx="3" ry="4.5" fill="#A8C5A8" transform="rotate(-45 19.5 19.5)" />
          </svg>
          <Typography variant="h6">
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "primary.dark", letterSpacing: "0.04em", lineHeight: 1.1 }}>English Turn</div>
              <div style={{ fontSize: "0.65rem", color: "primary.light", letterSpacing: "0.12em", textTransform: "uppercase" }}>Garden Club</div>
            </div>
          </Typography>
        </Box>

        {/* Nav links */}
        <Box sx={{ display: "flex", gap: 1, flex: 1 }}>
          {NAV_LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Button
                key={link.href}
                href={link.href}
                color="inherit"
                sx={{
                  fontWeight: active ? 600 : 400,
                  borderBottom: active ? "2px solid" : "2px solid transparent",
                  borderRadius: 0,
                  pb: "2px",
                  borderColor: active ? "primary.main" : "transparent",
                  "&:hover": { borderColor: "primary.light", bgcolor: "transparent" },
                }}
              >
                {link.label}
              </Button>
            );
          })}
        </Box>

        {/* User avatar with dropdown */}
        {!loading && user && (
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              onClick={handleAvatarClick}
              size="small"
              aria-label="Account menu"
              aria-controls={menuOpen ? "account-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={menuOpen ? "true" : undefined}
            >
              <Avatar sx={{ bgcolor: "primary.main", width: 34, height: 34, fontSize: 14 }}>
                {initials}
              </Avatar>
            </IconButton>
            <Menu
              id="account-menu"
              anchorEl={anchorEl}
              open={menuOpen}
              onClose={handleMenuClose}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              <MenuItem onClick={handleSignOut}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Log out
              </MenuItem>
            </Menu>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
