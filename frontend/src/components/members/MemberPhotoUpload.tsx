"use client";

import { useRef, useState } from "react";
import { Avatar, Box, Button, CircularProgress, Typography } from "@mui/material";
import PhotoCameraIcon from "@mui/icons-material/PhotoCameraOutlined";
import { Member } from "@/types/member";
import { MemberService, memberErrorMessage } from "@/services/memberService";
import { ImageService } from "@/services/imageService";
import { memberInitials } from "./MemberCard";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

interface MemberPhotoUploadProps {
  member: Member;
  disabled?: boolean;
  /** Called with the updated member once the new photo is saved. */
  onUploaded: (member: Member) => void;
  onError: (message: string) => void;
}

/**
 * Avatar + "Change photo" button. Picking a file uploads it straight away:
 * POST /members/me/photo (presign) → PUT to S3 → PUT /members/me {photoKey}.
 * The backend deletes the previous photo object when the key changes.
 */
export function MemberPhotoUpload({
  member,
  disabled,
  onUploaded,
  onError,
}: MemberPhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError("Please choose an image file");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      onError("Photo must be 5 MB or smaller");
      return;
    }

    try {
      setUploading(true);
      const { uploadUrl, photoKey } = await MemberService.presignMyPhoto(file.name, file.type);
      await ImageService.uploadToS3(uploadUrl, file, file.type);
      onUploaded(await MemberService.updateMe({ photoKey }));
    } catch (err) {
      onError(memberErrorMessage(err, "Failed to upload photo"));
    } finally {
      setUploading(false);
      // Allow re-selecting the same file after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
      <Box sx={{ position: "relative", flexShrink: 0 }}>
        <Avatar
          src={member.photoUrl}
          alt={member.name || member.email}
          sx={{ bgcolor: "primary.main", width: 88, height: 88, fontSize: 32 }}
        >
          {memberInitials(member)}
        </Avatar>
        {uploading && (
          <CircularProgress
            size={96}
            sx={{ position: "absolute", top: -4, left: -4 }}
            aria-label="Uploading photo"
          />
        )}
      </Box>

      <Box>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button
          variant="outlined"
          startIcon={<PhotoCameraIcon />}
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? "Uploading..." : member.photoUrl ? "Change photo" : "Add photo"}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          JPG, PNG or GIF, up to 5 MB
        </Typography>
      </Box>
    </Box>
  );
}
