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
  setProject: (project: Project) => void;
  clearProject: () => void;
  setSelectedTaskId: (taskId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateTask: (task: Task) => void;
  updateAgent: (agent: AgentState) => void;
  addArtifact: (artifact: Artifact) => void;
  updateArtifact: (artifact: Artifact) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  selectedTaskId: null,
  isLoading: false,
  error: null,

  setProject: (project) => set({ project, error: null }),

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

  updateTask: (task) =>
    set((state) => {
      if (!state.project) return state;
      const taskIndex = state.project.tasks.findIndex((t) => t.id === task.id);
      const newTasks = [...state.project.tasks];

      if (taskIndex >= 0) {
        // 合并更新（保留 streaming_output 等增量字段）
        newTasks[taskIndex] = { ...newTasks[taskIndex], ...task };
      } else {
        newTasks.push(task);
      }

      return {
        project: { ...state.project, tasks: newTasks },
      };
    }),

  updateAgent: (agent) =>
    set((state) => {
      if (!state.project) return state;
      const agentIndex = state.project.agents.findIndex((a) => a.id === agent.id);
      const newAgents = [...state.project.agents];

      if (agentIndex >= 0) {
        newAgents[agentIndex] = { ...newAgents[agentIndex], ...agent };
      } else {
        newAgents.push(agent);
      }

      return {
        project: { ...state.project, agents: newAgents },
      };
    }),

  addArtifact: (artifact) =>
    set((state) => {
      if (!state.project) return state;
      return {
        project: {
          ...state.project,
          artifacts: [...state.project.artifacts, artifact],
        },
      };
    }),

  updateArtifact: (artifact) =>
    set((state) => {
      if (!state.project) return state;
      const artifactIndex = state.project.artifacts.findIndex(
        (a) => a.id === artifact.id
      );
      const newArtifacts = [...state.project.artifacts];

      if (artifactIndex >= 0) {
        newArtifacts[artifactIndex] = { ...newArtifacts[artifactIndex], ...artifact };
      } else {
        newArtifacts.push(artifact);
      }

      return {
        project: { ...state.project, artifacts: newArtifacts },
      };
    }),
}));
