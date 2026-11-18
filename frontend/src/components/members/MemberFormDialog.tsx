"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
  MenuItem,
} from "@mui/material";
import { Member, MemberRole } from "@/types/member";
import { MemberService, memberErrorMessage } from "@/services/memberService";

interface MemberFormDialogProps {
  open: boolean;
  // When set, the dialog edits this member; otherwise it creates a new one.
  member?: Member | null;
  onClose: () => void;
  onSaved: (member: Member) => void;
}

export function MemberFormDialog({
  open,
  member,
  onClose,
  onSaved,
}: MemberFormDialogProps) {
  const isEdit = Boolean(member);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [role, setRole] = useState<MemberRole>("MEMBER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reseed the fields whenever the dialog opens or targets a different member.
  useEffect(() => {
    if (open) {
      setName(member?.name ?? "");
      setEmail(member?.email ?? "");
      setPhone(member?.phone ?? "");
      setAddress(member?.address ?? "");
      setRole(member?.role ?? "MEMBER");
      setError(null);
    }
  }, [open, member]);

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let saved: Member;
      if (isEdit && member) {
        saved = await MemberService.updateMember(member.memberId, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim(),
          role,
        });
      } else {
        saved = await MemberService.createMember({
          name: name.trim(),
          email: email.trim(),
        });
      }

      onSaved(saved);
    } catch (err) {
      setError(
        memberErrorMessage(
          err,
          isEdit ? "Failed to update member" : "Failed to add member"
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const emailChanged = isEdit && member && email.trim() !== member.email;

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? "Edit Member" : "Add Member"}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {!isEdit && (
            <Alert severity="info">
              Adding a member creates their account and emails them an invite with
              a temporary password.
            </Alert>
          )}

          <TextField
            fullWidth
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            required
          />

          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />

          {emailChanged && (
            <Alert severity="warning">
              Changing the email updates where invite and reset emails are sent,
              but does not change the member&apos;s existing sign-in username.
            </Alert>
          )}

          {isEdit && (
            <>
              <TextField
                fullWidth
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />

              <TextField
                fullWidth
                label="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={loading}
              />

              <TextField
                select
                fullWidth
                label="Role"
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
                disabled={loading}
              >
                <MenuItem value="MEMBER">Member</MenuItem>
                <MenuItem value="ADMIN">Admin</MenuItem>
              </TextField>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? "Saving..." : isEdit ? "Save Changes" : "Add Member"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
