"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Box,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SendIcon from "@mui/icons-material/Send";
import { Member } from "@/types/member";

interface MemberListProps {
  members: Member[];
  // memberId currently mid-action, so its buttons show a disabled/busy state.
  busyMemberId?: string | null;
  onEdit: (member: Member) => void;
  onResendInvite: (member: Member) => void;
  onDelete: (member: Member) => void;
}

export function MemberList({
  members,
  busyMemberId,
  onEdit,
  onResendInvite,
  onDelete,
}: MemberListProps) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {members.map((member) => {
            const busy = busyMemberId === member.memberId;
            const isInvited = member.status === "INVITED";
            return (
              <TableRow key={member.memberId} hover>
                <TableCell>{member.name || "—"}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={isInvited ? "Invited" : "Active"}
                    color={isInvited ? "warning" : "success"}
                    variant={isInvited ? "outlined" : "filled"}
                  />
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <Tooltip title="Edit">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => onEdit(member)}
                          disabled={busy}
                          aria-label={`Edit ${member.name || member.email}`}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip
                      title={
                        isInvited
                          ? "Resend invite"
                          : "Member has already accepted the invite"
                      }
                    >
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => onResendInvite(member)}
                          disabled={busy || !isInvited}
                          aria-label={`Resend invite to ${member.name || member.email}`}
                        >
                          <SendIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Remove">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => onDelete(member)}
                          disabled={busy}
                          aria-label={`Remove ${member.name || member.email}`}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
