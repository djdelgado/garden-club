export interface Event {
  eventId: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  headerImageKey?: string;
  // Browser-loadable banner URL (CloudFront in AWS), derived server-side from
  // headerImageKey. The images bucket itself is private.
  headerImageUrl?: string;
  createdAt: string;
  createdBy: string;
  // RSVP summary (computed server-side for the authenticated caller).
  rsvpCount: number;
  isAttending: boolean;
  // Attendee display names — only returned by GET /events/{id}.
  attendees?: string[];
}

// Response shape of POST/DELETE /events/{id}/rsvp.
export interface RsvpSummary {
  rsvpCount: number;
  isAttending: boolean;
}
