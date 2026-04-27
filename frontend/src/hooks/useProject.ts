import { useCallback, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useEventStore } from '../store/eventStore';
import {
  getProject,
  startProject,
  pauseProject,
} from '../api/projects';
import { getTasks } from '../api/tasks';
import { getAgents } from '../api/agents';
import type { SSEEvent } from '../types';
import { useSSE } from './useSSE';

/**
 * 项目数据管理 Hook
 * 整合项目 CRUD 和实时事件流
 */
export function useProject(projectId: string | undefined) {
  const {
    project,
    isLoading,
    error,
    setProject,
    setLoading,
    setError,
  } = useProjectStore();

  const { addEvent } = useEventStore();

  // SSE 事件处理器 — 将后端事件转换为 store 更新
  const handleSSEEvent = useCallback(
    (event: SSEEvent) => {
      // 记录所有事件到事件日志
      addEvent({
        id: crypto.randomUUID(),
        project_id: event.project_id,
        agent_name: event.agent_name ?? undefined,
        event_type: event.type,
        event_level: event.type === 'error' ? 'error' : 'info',
        content: event.content ?? undefined,
        data: event.data,
        created_at: new Date().toISOString(),
      });

      // 更新 project store 中的任务状态
      if (event.task_id && event.type === 'task_status_changed') {
        setProject((prev) => {
          if (!prev) return prev;
          const tasks = prev.tasks ?? [];
          const idx = tasks.findIndex((t) => t.id === event.task_id);
          if (idx >= 0) {
            const newTasks = [...tasks];
            const newData = event.data || {};
            newTasks[idx] = {
              ...newTasks[idx],
              status: (newData.new_status as string) || newTasks[idx].status,
            };
            return { ...prev, tasks: newTasks };
          }
          return prev;
        });
      }
    },
    [addEvent, setProject]
  );

  // 订阅 SSE 事件
  useSSE(handleSSEEvent, {
    projectId: projectId || '',
    enabled: !!projectId,
  });

  // 加载项目数据（聚合 tasks 和 agents）
  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [projectData, tasksData, agentsData] = await Promise.all([
        getProject(projectId),
        getTasks(projectId).catch(() => []), // tasks 失败不阻塞
        getAgents().catch(() => []), // 加载全局 Agent 配置列表
      ]);
      setProject({
        ...projectData,
        tasks: tasksData,
        agents: agentsData.map((a) => ({
          id: a.name,
          agent_name: a.name,
          name: a.name,
          role: a.role,
          status: 'idle' as const,
          current_task: null,
        })),
        artifacts: [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载项目失败');
    } finally {
      setLoading(false);
    }
  }, [projectId, setProject, setLoading, setError]);

  // 启动项目
  const start = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await startProject(projectId);
      setProject((prev) => prev ? { ...prev, ...data } : data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动项目失败');
    } finally {
      setLoading(false);
    }
  }, [projectId, setProject, setLoading, setError]);

  // 暂停项目
  const pause = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await pauseProject(projectId);
      setProject((prev) => prev ? { ...prev, ...data } : data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '暂停项目失败');
    } finally {
      setLoading(false);
    }
  }, [projectId, setProject, setLoading, setError]);

  // 初始加载
  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId, fetchProject]);

  return {
    project,
    isLoading,
    error,
    fetchProject,
    start,
    pause,
  };
}

export default useProject;
