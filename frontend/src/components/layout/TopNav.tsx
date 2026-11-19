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
import PersonIcon from "@mui/icons-material/PersonOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "aws-amplify/auth";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { clearTokenCache } from "@/lib/api";

const BASE_LINKS = [
  { label: "Home", href: "/home" },
  { label: "Events", href: "/events" },
  { label: "Gallery", href: "/gallery" },
  { label: "Directory", href: "/directory" },
];

const ADMIN_LINKS = [{ label: "Members", href: "/admin/members" }];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  // Gate on !adminLoading so the admin link never flashes before the group
  // check resolves.
  const navLinks = isAdmin && !adminLoading ? [...BASE_LINKS, ...ADMIN_LINKS] : BASE_LINKS;
  const [initials, setInitials] = useState("");
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);
  // Below `md` the nav links collapse into this menu so they never overflow.
  const [navAnchorEl, setNavAnchorEl] = useState<null | HTMLElement>(null);
  const navMenuOpen = Boolean(navAnchorEl);

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
      <Toolbar sx={{ gap: { xs: 1, md: 2 }, justifyContent: "space-between", px: { xs: 2, sm: 3 } }}>
        {/* Logo */}
        <Box
          component="a"
          href="/home"
          sx={{ display: "flex", alignItems: "center", gap: 1, textDecoration: "none", color: "inherit", mr: { xs: 0, md: 2 }, flexShrink: 0 }}
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
          <Box>
            <Typography component="div" sx={{ fontSize: "1rem", fontWeight: 700, color: "primary.dark", letterSpacing: "0.04em", lineHeight: 1.1, whiteSpace: "nowrap" }}>
              English Turn
            </Typography>
            <Typography component="div" sx={{ fontSize: "0.65rem", color: "primary.light", letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              Garden Club
            </Typography>
          </Box>
        </Box>

        {/* Nav links (md and up) */}
        <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1, flex: 1 }}>
          {navLinks.map((link) => {
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

        {/* Nav menu (below md) + user avatar with dropdown */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: "auto" }}>
          <Box sx={{ display: { xs: "block", md: "none" } }}>
            <IconButton
              onClick={(e) => setNavAnchorEl(e.currentTarget)}
              aria-label="Navigation menu"
              aria-controls={navMenuOpen ? "nav-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={navMenuOpen ? "true" : undefined}
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="nav-menu"
              anchorEl={navAnchorEl}
              open={navMenuOpen}
              onClose={() => setNavAnchorEl(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              {navLinks.map((link) => (
                <MenuItem
                  key={link.href}
                  selected={pathname.startsWith(link.href)}
                  onClick={() => {
                    setNavAnchorEl(null);
                    router.push(link.href);
                  }}
                  sx={{ minWidth: 180 }}
                >
                  {link.label}
                </MenuItem>
              ))}
            </Menu>
          </Box>

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
                <MenuItem
                  onClick={() => {
                    handleMenuClose();
                    router.push("/profile");
                  }}
                  selected={pathname.startsWith("/profile")}
                >
                  <ListItemIcon>
                    <PersonIcon fontSize="small" />
                  </ListItemIcon>
                  My profile
                </MenuItem>
                <MenuItem onClick={handleSignOut}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  Log out
                </MenuItem>
              </Menu>
            </Box>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
