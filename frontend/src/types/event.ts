export interface Event {
  eventId: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  headerImageKey?: string;
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
