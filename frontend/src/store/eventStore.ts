import { create } from 'zustand';
import type { EventLog } from '../types';

interface EventState {
  events: EventLog[];
  maxEvents: number;
  filters: EventFilters;
  autoScroll: boolean;

  addEvent: (event: EventLog) => void;
  clearEvents: () => void;
  setFilterLevel: (level: string | null) => void;
  setFilterSource: (source: string | null) => void;
  setFilterSearch: (search: string) => void;
  setAutoScroll: (autoScroll: boolean) => void;
  getFilteredEvents: () => EventLog[];
}

export interface EventFilters {
  level: string | null;
  source: string | null;
  search: string;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  maxEvents: 500,
  filters: {
    level: null,
    source: null,
    search: '',
  },
  autoScroll: true,

  addEvent: (event) =>
    set((state) => {
      const newEvents = [...state.events, event];
      if (newEvents.length > state.maxEvents) {
        return { events: newEvents.slice(-state.maxEvents) };
      }
      return { events: newEvents };
    }),

  clearEvents: () => set({ events: [] }),

  setFilterLevel: (level) =>
    set((state) => ({ filters: { ...state.filters, level } })),

  setFilterSource: (source) =>
    set((state) => ({ filters: { ...state.filters, source } })),

  setFilterSearch: (search) =>
    set((state) => ({ filters: { ...state.filters, search } })),

  setAutoScroll: (autoScroll) => set({ autoScroll }),

  getFilteredEvents: () => {
    const { events, filters } = get();
    return events.filter((event) => {
      if (filters.level && event.event_level !== filters.level) return false;
      if (filters.source && (event.agent_name || '') !== filters.source) return false;
      const text = (event.content || event.message || '').toLowerCase();
      if (filters.search && !text.includes(filters.search.toLowerCase())) return false;
      return true;
    });
  },
}));
