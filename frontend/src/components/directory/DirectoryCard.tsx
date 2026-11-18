"use client";

import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Link,
  Tooltip,
  Typography,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/EmailOutlined";
import PhoneIcon from "@mui/icons-material/PhoneOutlined";
import HomeIcon from "@mui/icons-material/HomeOutlined";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import PersonAddIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import { DirectoryEntry } from "@/types/directory";

interface DirectoryCardProps {
  entry: DirectoryEntry;
  /** Admin-only actions; omitted for regular members. */
  onEdit?: (entry: DirectoryEntry) => void;
  onDelete?: (entry: DirectoryEntry) => void;
  onInvite?: (entry: DirectoryEntry) => void;
  inviting?: boolean;
}

/** "Jane Q. Public" -> "JP". */
function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return letters.slice(0, 2) || "?";
}

export function DirectoryCard({ entry, onEdit, onDelete, onInvite, inviting }: DirectoryCardProps) {
  const linked = entry.linkedMember;
  const canInvite = !!onInvite && !linked && !!entry.email;

  return (
    <Card sx={{ borderRadius: 3, boxShadow: 2, height: "100%" }}>
      <CardContent sx={{ display: "flex", gap: 2 }}>
        <Avatar
          src={linked?.photoUrl}
          alt={entry.name}
          sx={{ bgcolor: "primary.main", width: 56, height: 56, fontSize: 20 }}
        >
          {initials(entry.name)}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
              {entry.name}
            </Typography>
            {linked && (
              <Chip
                size="small"
                label={linked.status === "ACTIVE" ? "App member" : "Invited"}
                color={linked.status === "ACTIVE" ? "success" : "default"}
                variant="outlined"
              />
            )}
          </Box>

          {entry.email && (
            <ContactRow icon={<EmailIcon fontSize="small" />}>
              <Link href={`mailto:${entry.email}`} underline="hover" noWrap>
                {entry.email}
              </Link>
            </ContactRow>
          )}

          {entry.phone && (
            <ContactRow icon={<PhoneIcon fontSize="small" />}>
              <Link href={`tel:${entry.phone.replace(/[^\d+]/g, "")}`} underline="hover">
                {entry.phone}
              </Link>
            </ContactRow>
          )}

          {entry.address && (
            <ContactRow icon={<HomeIcon fontSize="small" />}>
              <Typography variant="body2" color="text.secondary">
                {entry.address}
              </Typography>
            </ContactRow>
          )}
        </Box>

        {(onEdit || onDelete || canInvite) && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: -1, mr: -1 }}>
            {canInvite && (
              <Tooltip title="Invite to app">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => onInvite(entry)}
                    disabled={inviting}
                    aria-label={`Invite ${entry.name} to the app`}
                  >
                    <PersonAddIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {onEdit && (
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => onEdit(entry)} aria-label={`Edit ${entry.name}`}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {onDelete && (
              <Tooltip title="Remove from directory">
                <IconButton size="small" onClick={() => onDelete(entry)} aria-label={`Remove ${entry.name}`}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function ContactRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        mt: 0.5,
        color: "text.secondary",
        minWidth: 0,
        "& a": { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" },
      }}
    >
      {icon}
      {children}
    </Box>
  );
}
