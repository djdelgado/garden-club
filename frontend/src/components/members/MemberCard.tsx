"use client";

import { Avatar, Box, Card, CardContent, Link, Typography } from "@mui/material";
import EmailIcon from "@mui/icons-material/EmailOutlined";
import PhoneIcon from "@mui/icons-material/PhoneOutlined";
import HomeIcon from "@mui/icons-material/HomeOutlined";
import { Member } from "@/types/member";

interface MemberCardProps {
  member: Member;
}

/** "Jane Q. Public" -> "JP"; falls back to the first letter of the email. */
export function memberInitials(member: Member): string {
  const fromName = (member.name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  if (fromName) {
    return fromName.slice(0, 2);
  }
  return (member.email?.[0] ?? "?").toUpperCase();
}

export function MemberCard({ member }: MemberCardProps) {
  const displayName = member.name || member.email;

  return (
    <Card sx={{ borderRadius: 3, boxShadow: 2, height: "100%" }}>
      <CardContent sx={{ display: "flex", gap: 2 }}>
        <Avatar
          src={member.photoUrl}
          alt={displayName}
          sx={{ bgcolor: "primary.main", width: 56, height: 56, fontSize: 20 }}
        >
          {memberInitials(member)}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
            {displayName}
          </Typography>

          <ContactRow icon={<EmailIcon fontSize="small" />}>
            <Link href={`mailto:${member.email}`} underline="hover" noWrap>
              {member.email}
            </Link>
          </ContactRow>

          {member.phone && (
            <ContactRow icon={<PhoneIcon fontSize="small" />}>
              <Link href={`tel:${member.phone.replace(/[^\d+]/g, "")}`} underline="hover">
                {member.phone}
              </Link>
            </ContactRow>
          )}

          {member.address && (
            <ContactRow icon={<HomeIcon fontSize="small" />}>
              <Typography variant="body2" color="text.secondary">
                {member.address}
              </Typography>
            </ContactRow>
          )}
        </Box>
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
