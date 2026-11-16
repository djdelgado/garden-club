"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Container,
  Typography,
  Alert,
  Grid,
  TextField,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { MemberService } from "@/services/memberService";
import { Member } from "@/types/member";
import { MemberCard } from "@/components/members/MemberCard";
import { MemberCardSkeleton } from "@/components/common/MemberCardSkeleton";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";

export default function DirectoryPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const showSkeleton = useDelayedFlag(loading);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        setLoading(true);
        const data = await MemberService.getMembers();
        // The API already sorts by name; sort again so the order holds even if
        // a member has no name yet (INVITED members may only have an email).
        data.sort((a, b) =>
          (a.name || a.email).localeCompare(b.name || b.email, undefined, {
            sensitivity: "base",
          })
        );
        setMembers(data);
        setError(null);
      } catch (err) {
        setError("Failed to load the member directory");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;
    return members.filter((m) => (m.name || "").toLowerCase().includes(term));
  }, [members, search]);

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Box
          sx={{
            mb: 4,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Box>
            <Typography
              sx={{
                fontSize: "0.75rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "primary.main",
                mb: 0.5,
              }}
            >
              Neighbors
            </Typography>
            <Typography variant="h3" sx={{ fontStyle: "italic" }}>
              Member Directory
            </Typography>
          </Box>

          <TextField
            size="small"
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={loading}
            sx={{ minWidth: 260 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                "aria-label": "Search members by name",
              },
            }}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Grid container spacing={2}>
            {showSkeleton &&
              Array.from({ length: 6 }).map((_, index) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                  <MemberCardSkeleton />
                </Grid>
              ))}
          </Grid>
        ) : members.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="body1" color="text.secondary">
              No members yet
            </Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="body1" color="text.secondary">
              No members match &ldquo;{search.trim()}&rdquo;
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {filtered.map((member) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={member.memberId}>
                <MemberCard member={member} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Container>
  );
}
