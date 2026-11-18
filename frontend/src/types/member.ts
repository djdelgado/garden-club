export type MemberStatus = "INVITED" | "ACTIVE";
export type MemberRole = "MEMBER" | "ADMIN";

export interface Member {
  memberId: string;
  cognitoSub: string;
  cognitoUsername: string;
  email: string;
  name: string;
  phone?: string;
  address?: string;
  photoKey?: string;
  photoUrl?: string;
  status: MemberStatus;
  role?: MemberRole;
  createdAt: string;
  updatedAt: string;
  lastInviteSentAt?: string;
  // Only on a POST /members response: true when the email already had a Cognito
  // login (e.g. the bootstrap admin) and it was linked instead of invited.
  linkedExistingAccount?: boolean;
}

// POST /members accepts only name + email; the backend provisions Cognito.
export interface CreateMemberInput {
  name: string;
  email: string;
}

// PUT /members/{memberId} — admins may edit these fields.
export interface UpdateMemberInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  role?: MemberRole;
}

// PUT /members/me — self-service. The backend rejects any other field
// (email, role, status, ids), so the profile form never offers them.
export interface UpdateMeInput {
  name?: string;
  phone?: string;
  address?: string;
  photoKey?: string;
}

// POST /members/me/photo response: a presigned S3 PUT plus the key to save.
export interface MemberPhotoUpload {
  uploadUrl: string;
  photoKey: string;
}
