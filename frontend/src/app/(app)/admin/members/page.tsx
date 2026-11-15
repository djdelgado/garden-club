"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Alert,
  Button,
  CircularProgress,
  Snackbar,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { MemberService, memberErrorMessage } from "@/services/memberService";
import { Member } from "@/types/member";
import { MemberList } from "@/components/members/MemberList";
import { MemberFormDialog } from "@/components/members/MemberFormDialog";

export default function MembersAdminPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await MemberService.getMembers();
      setMembers(data);
      setError(null);
    } catch (err) {
      setError("Failed to load members");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Keep the list sorted by name so a newly added/edited member lands in place,
  // mirroring the backend's name-sorted GET /members.
  const upsertMember = (saved: Member) => {
    setMembers((prev) => {
      const next = prev.filter((m) => m.memberId !== saved.memberId);
      next.push(saved);
      next.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      return next;
    });
  };

  const handleAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (member: Member) => {
    setEditing(member);
    setFormOpen(true);
  };

  const handleSaved = (saved: Member) => {
    upsertMember(saved);
    setToast(editing ? "Member updated" : "Invite sent");
    setFormOpen(false);
    setEditing(null);
  };

  const handleResendInvite = async (member: Member) => {
    try {
      setBusyMemberId(member.memberId);
      await MemberService.resendInvite(member.memberId);
      setToast(`Invite resent to ${member.email}`);
    } catch (err) {
      setError(memberErrorMessage(err, "Failed to resend invite"));
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleDelete = async (member: Member) => {
    if (
      !confirm(
        `Remove ${member.name || member.email}? This deletes their account and cannot be undone.`
      )
    ) {
      return;
    }
    try {
      setBusyMemberId(member.memberId);
      await MemberService.deleteMember(member.memberId);
      setMembers((prev) => prev.filter((m) => m.memberId !== member.memberId));
      setToast("Member removed");
    } catch (err) {
      setError(memberErrorMessage(err, "Failed to remove member"));
    } finally {
      setBusyMemberId(null);
    }
  };

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
            <Typography sx={{ fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "primary.main", mb: 0.5 }}>
              Administration
            </Typography>
            <Typography variant="h3" sx={{ fontStyle: "italic" }}>
              Members
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={handleAdd}
          >
            Add Member
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : members.length === 0 ? (
          <Typography variant="body1" color="text.secondary">
            No members yet. Add one to send an invite.
          </Typography>
        ) : (
          <MemberList
            members={members}
            busyMemberId={busyMemberId}
            onEdit={handleEdit}
            onResendInvite={handleResendInvite}
            onDelete={handleDelete}
          />
        )}

        <MemberFormDialog
          open={formOpen}
          member={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />

        <Snackbar
          open={Boolean(toast)}
          autoHideDuration={4000}
          onClose={() => setToast(null)}
          message={toast ?? ""}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        />
      </Box>
    </Container>
  );
}
