import { Event } from '@/types/event';
import { apiGet, apiPost } from '../lib/api';

const EVENT_PATH = "/events";

export const EventService = {

  getEvents: async () => {
    return apiGet<Event[]>(EVENT_PATH);
  },

  createEvent: async (event: Record<string, unknown>) => {
    await apiPost(EVENT_PATH, event);
  },
};
