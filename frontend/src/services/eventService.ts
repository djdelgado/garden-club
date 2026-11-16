import { Event, RsvpSummary } from '@/types/event';
import { apiGet, apiPost, apiDelete } from '../lib/api';

const EVENT_PATH = "/events";

export const EventService = {

  getEvents: async (startTime?: string) => {
    const url = startTime ? `${EVENT_PATH}?startTime=${startTime}` : EVENT_PATH;
    return apiGet<Event[]>(url);
  },

  getEvent: async (eventId: string) => {
    return apiGet<Event>(`${EVENT_PATH}/${eventId}`);
  },

  createEvent: async (event: Record<string, unknown>) => {
    await apiPost(EVENT_PATH, event);
  },

  rsvp: async (eventId: string) => {
    return apiPost<RsvpSummary>(`${EVENT_PATH}/${eventId}/rsvp`, {});
  },

  unrsvp: async (eventId: string) => {
    return apiDelete<RsvpSummary>(`${EVENT_PATH}/${eventId}/rsvp`);
  },
};
