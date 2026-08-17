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
