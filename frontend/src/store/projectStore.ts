import { create } from 'zustand';
import type { Project, Task, AgentState, Artifact } from '../types';

interface ProjectState {
  /** 当前项目 */
  project: Project | null;
  /** 选中的任务 ID */
  selectedTaskId: string | null;
  /** 加载状态 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;

  // Actions
  setProject: (project: Project | ((prev: Project | null) => Project | null)) => void;
  clearProject: () => void;
  setSelectedTaskId: (taskId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  selectedTaskId: null,
  isLoading: false,
  error: null,

  setProject: (projectOrUpdater) =>
    set((state) => {
      const project =
        typeof projectOrUpdater === 'function'
          ? projectOrUpdater(state.project)
          : projectOrUpdater;
      return { project, error: null };
    }),

  clearProject: () =>
    set({
      project: null,
      selectedTaskId: null,
      isLoading: false,
      error: null,
    }),

  setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),
}));
