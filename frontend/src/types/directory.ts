import { MemberStatus } from "@/types/member";

/** The app member an entry is linked to (matched by email at read time). */
export interface LinkedMember {
  memberId: string;
  status: MemberStatus;
  photoUrl?: string;
}

/** A row in the club directory: the roster, independent of app accounts. */
export interface DirectoryEntry {
  entryId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
  linkedMember?: LinkedMember;
}

/** POST/PUT body. On PUT, "" clears a field; omitted fields are unchanged. */
export interface DirectoryEntryInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

/** One spreadsheet row sent to POST /directory/import. */
export type DirectoryImportRow = DirectoryEntryInput;

export interface DirectoryImportResult {
  created: number;
  updated: number;
  skipped: { row: number; reason: string }[];
}
