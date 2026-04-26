import { create } from 'zustand';
import type { EventLog, EventLevel, EventSource } from '../types';

interface EventState {
  /** 事件日志列表 */
  events: EventLog[];
  /** 最大保留事件数 */
  maxEvents: number;
  /** 过滤条件 */
  filters: EventFilters;
  /** 是否自动滚动到底部 */
  autoScroll: boolean;

  // Actions
  addEvent: (event: EventLog) => void;
  clearEvents: () => void;
  setFilterLevel: (level: EventLevel | null) => void;
  setFilterSource: (source: EventSource | null) => void;
  setFilterSearch: (search: string) => void;
  setAutoScroll: (autoScroll: boolean) => void;
  getFilteredEvents: () => EventLog[];
}

export interface EventFilters {
  level: EventLevel | null;
  source: EventSource | null;
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
      // 限制最大事件数
      if (newEvents.length > state.maxEvents) {
        return { events: newEvents.slice(-state.maxEvents) };
      }
      return { events: newEvents };
    }),

  clearEvents: () => set({ events: [] }),

  setFilterLevel: (level) =>
    set((state) => ({
      filters: { ...state.filters, level },
    })),

  setFilterSource: (source) =>
    set((state) => ({
      filters: { ...state.filters, source },
    })),

  setFilterSearch: (search) =>
    set((state) => ({
      filters: { ...state.filters, search },
    })),

  setAutoScroll: (autoScroll) => set({ autoScroll }),

  getFilteredEvents: () => {
    const { events, filters } = get();
    return events.filter((event) => {
      if (filters.level && event.level !== filters.level) return false;
      if (filters.source && event.source !== filters.source) return false;
      if (
        filters.search &&
        !event.message.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      return true;
    });
  },
}));
