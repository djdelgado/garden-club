import { Event } from '@/types/event';
import { apiGet, apiPost } from '../lib/api';

const EVENT_PATH = "/events";

export const EventService = {

  getEvents: async (startTime?: string) => {
    const url = startTime ? `${EVENT_PATH}?startTime=${startTime}` : EVENT_PATH;
    return apiGet<Event[]>(url);
  },

  createEvent: async (event: Record<string, unknown>) => {
    await apiPost(EVENT_PATH, event);
  },
};
