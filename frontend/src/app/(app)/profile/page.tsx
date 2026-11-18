"use client";

import { useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Grid,
  Skeleton,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { useMe } from "@/hooks/useMe";
import { MemberService, memberErrorMessage } from "@/services/memberService";
import { MemberPhotoUpload } from "@/components/members/MemberPhotoUpload";
import { Member } from "@/types/member";

/**
 * Member self-service profile (`me`-scoped — there is deliberately no
 * /profile/[memberId]; the static export can't serve dynamic routes).
 *
 * Only name, phone, address and photo are editable. Email and role are shown
 * read-only: PUT /members/me rejects them, and a self-service email change
 * would desync the immutable Cognito username.
 */
export default function ProfilePage() {
  const { me, setMe, loading, error: loadError } = useMe();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Seed the form from the loaded record (and after each save).
  useEffect(() => {
    if (me) {
      setName(me.name ?? "");
      setPhone(me.phone ?? "");
      setAddress(me.address ?? "");
    }
  }, [me]);

  const dirty =
    !!me &&
    (name.trim() !== (me.name ?? "") ||
      phone.trim() !== (me.phone ?? "") ||
      address.trim() !== (me.address ?? ""));

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }
    setNameError(null);

    try {
      setSaving(true);
      setError(null);
      setMe(
        await MemberService.updateMe({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
        })
      );
      setToast("Profile saved");
    } catch (err) {
      setError(memberErrorMessage(err, "Failed to save your profile"));
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUploaded = (updated: Member) => {
    setError(null);
    setMe(updated);
    setToast("Photo updated");
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography
            sx={{
              fontSize: "0.75rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "primary.main",
              mb: 0.5,
            }}
          >
            Your account
          </Typography>
          <Typography variant="h3" sx={{ fontStyle: "italic" }}>
            My Profile
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            What you enter here appears in the member directory.
          </Typography>
        </Box>

        {loadError && <Alert severity="error">{loadError}</Alert>}

        {loading && !me && (
          <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
            <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Skeleton variant="circular" width={88} height={88} />
              <Skeleton variant="rounded" height={56} />
              <Skeleton variant="rounded" height={56} />
              <Skeleton variant="rounded" height={96} />
            </CardContent>
          </Card>
        )}

        {me && (
          <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
            <CardContent
              component="form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
              sx={{ display: "flex", flexDirection: "column", gap: 3, p: { xs: 2, sm: 4 } }}
            >
              {error && <Alert severity="error">{error}</Alert>}

              <MemberPhotoUpload
                member={me}
                disabled={saving}
                onUploaded={handlePhotoUploaded}
                onError={setError}
              />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={saving}
                    required
                    error={!!nameError}
                    helperText={nameError}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={saving}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={saving}
                    multiline
                    minRows={2}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={me.email}
                    disabled
                    helperText="Ask an admin to change your email"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Role"
                    value={me.role === "ADMIN" ? "Admin" : "Member"}
                    disabled
                  />
                </Grid>
              </Grid>

              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving || !dirty}
                  startIcon={saving ? <CircularProgress size={20} /> : undefined}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setToast(null)}>
          {toast}
        </Alert>
      </Snackbar>
    </Container>
  );
}
