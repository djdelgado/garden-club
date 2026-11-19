"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  InputAdornment,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFileOutlined";
import GroupAddIcon from "@mui/icons-material/GroupAddOutlined";
import { DirectoryService } from "@/services/directoryService";
import { MemberService, memberErrorMessage } from "@/services/memberService";
import { DirectoryEntry } from "@/types/directory";
import { DirectoryCard } from "@/components/directory/DirectoryCard";
import { DirectoryEntryDialog } from "@/components/directory/DirectoryEntryDialog";
import { ImportDirectoryDialog } from "@/components/directory/ImportDirectoryDialog";
import { MemberCardSkeleton } from "@/components/common/MemberCardSkeleton";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * The club directory: the garden club's roster, maintained by admins and
 * independent of app accounts. Entries whose email matches an app member are
 * linked (photo + chip). Admins can add/edit/remove entries, import a
 * spreadsheet, and invite entries to the app.
 */
export default function DirectoryPage() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const showAdmin = isAdmin && !adminLoading;

  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const showSkeleton = useDelayedFlag(loading);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DirectoryEntry | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<DirectoryEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteAllOpen, setInviteAllOpen] = useState(false);
  // Progress of a bulk invite run; null before one starts.
  const [inviteRun, setInviteRun] = useState<{ total: number; done: number; failed: string[] } | null>(null);
  const inviteRunning = !!inviteRun && inviteRun.done < inviteRun.total;

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      setEntries(await DirectoryService.list());
      setError(null);
    } catch (err) {
      setError("Failed to load the directory");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((e) => e.name.toLowerCase().includes(term));
  }, [entries, search]);

  // Entries that can be invited: have an email and aren't an app member yet.
  const invitable = useMemo(() => entries.filter((e) => e.email && !e.linkedMember), [entries]);

  const handleSaved = () => {
    setToast(editing ? "Entry updated" : "Added to directory");
    setFormOpen(false);
    setEditing(null);
    loadEntries();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      setDeleteBusy(true);
      await DirectoryService.remove(deleting.entryId);
      setEntries((prev) => prev.filter((e) => e.entryId !== deleting.entryId));
      setToast(`Removed ${deleting.name} from the directory`);
      setDeleting(null);
    } catch (err) {
      setError(memberErrorMessage(err, "Failed to remove entry"));
    } finally {
      setDeleteBusy(false);
    }
  };

  const invite = (entry: DirectoryEntry) =>
    MemberService.createMember({ name: entry.name, email: entry.email! });

  const handleInvite = async (entry: DirectoryEntry) => {
    try {
      setInvitingId(entry.entryId);
      const member = await invite(entry);
      setToast(
        member.linkedExistingAccount
          ? `Linked ${entry.name}'s existing login`
          : `Invite sent to ${entry.email}`
      );
      await loadEntries();
    } catch (err) {
      setError(memberErrorMessage(err, `Failed to invite ${entry.name}`));
    } finally {
      setInvitingId(null);
    }
  };

  const handleInviteAll = async () => {
    // Snapshot the targets: `invitable` changes as the run progresses.
    const targets = [...invitable];
    const failed: string[] = [];
    setInviteRun({ total: targets.length, done: 0, failed });
    // Sequential on purpose: each invite is a Cognito AdminCreateUser + email.
    for (let i = 0; i < targets.length; i++) {
      try {
        await invite(targets[i]);
      } catch (err) {
        failed.push(`${targets[i].name}: ${memberErrorMessage(err, "failed")}`);
      }
      setInviteRun({ total: targets.length, done: i + 1, failed: [...failed] });
    }
    await loadEntries();
  };

  const closeInviteAll = () => {
    if (inviteRunning) return;
    setInviteAllOpen(false);
    setInviteRun(null);
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
              Club Directory
            </Typography>
          </Box>

          <TextField
            size="small"
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={loading}
            sx={{ width: { xs: "100%", sm: "auto" }, minWidth: { sm: 260 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                "aria-label": "Search the directory by name",
              },
            }}
          />
        </Box>

        {showAdmin && (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Add entry
            </Button>
            <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setImportOpen(true)}>
              Import spreadsheet
            </Button>
            <Button
              variant="outlined"
              startIcon={<GroupAddIcon />}
              onClick={() => setInviteAllOpen(true)}
              disabled={loading || invitable.length === 0}
            >
              Invite all not yet members{invitable.length ? ` (${invitable.length})` : ""}
            </Button>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading && entries.length === 0 ? (
          <Grid container spacing={2}>
            {showSkeleton &&
              Array.from({ length: 6 }).map((_, index) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                  <MemberCardSkeleton />
                </Grid>
              ))}
          </Grid>
        ) : entries.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="body1" color="text.secondary">
              {showAdmin
                ? "The directory is empty. Add entries or import the club roster from a spreadsheet."
                : "The directory is empty"}
            </Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="body1" color="text.secondary">
              No one matches &ldquo;{search.trim()}&rdquo;
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {filtered.map((entry) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={entry.entryId}>
                <DirectoryCard
                  entry={entry}
                  onEdit={
                    showAdmin
                      ? (e) => {
                          setEditing(e);
                          setFormOpen(true);
                        }
                      : undefined
                  }
                  onDelete={showAdmin ? setDeleting : undefined}
                  onInvite={showAdmin ? handleInvite : undefined}
                  inviting={invitingId === entry.entryId}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <DirectoryEntryDialog
        open={formOpen}
        entry={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
      />

      <ImportDirectoryDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={loadEntries} />

      <Dialog open={!!deleting} onClose={deleteBusy ? undefined : () => setDeleting(null)}>
        <DialogTitle>Remove from directory?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleting?.name} will be removed from the club directory.
            {deleting?.linkedMember &&
              " Their app account is not affected; manage it on the Members page."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)} disabled={deleteBusy}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleteBusy}>
            {deleteBusy ? "Removing..." : "Remove"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={inviteAllOpen} onClose={closeInviteAll} maxWidth="sm" fullWidth>
        <DialogTitle>Invite to the app</DialogTitle>
        <DialogContent>
          {!inviteRun ? (
            <DialogContentText component="div">
              Send an app invite email to {invitable.length}{" "}
              {invitable.length === 1 ? "person" : "people"} in the directory who aren&apos;t app
              members yet:
              <Box component="ul" sx={{ maxHeight: 200, overflow: "auto", mt: 1, mb: 0 }}>
                {invitable.map((e) => (
                  <li key={e.entryId}>
                    {e.name} ({e.email})
                  </li>
                ))}
              </Box>
            </DialogContentText>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                {inviteRunning && <CircularProgress size={20} />}
                <Typography>
                  {inviteRunning
                    ? `Inviting ${inviteRun.done + 1} of ${inviteRun.total}...`
                    : `Done: ${inviteRun.total - inviteRun.failed.length} invited${
                        inviteRun.failed.length ? `, ${inviteRun.failed.length} failed` : ""
                      }.`}
                </Typography>
              </Box>
              {inviteRun.failed.length > 0 && (
                <Alert severity="warning">
                  <Box component="ul" sx={{ m: 0, pl: 2 }}>
                    {inviteRun.failed.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </Box>
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!inviteRun ? (
            <>
              <Button onClick={closeInviteAll}>Cancel</Button>
              <Button variant="contained" onClick={handleInviteAll}>
                Send {invitable.length} {invitable.length === 1 ? "invite" : "invites"}
              </Button>
            </>
          ) : (
            <Button variant="contained" onClick={closeInviteAll} disabled={inviteRunning}>
              Done
            </Button>
          )}
        </DialogActions>
      </Dialog>

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
