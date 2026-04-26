import { useCallback, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useEventStore } from '../store/eventStore';
import {
  getProject,
  startProject,
  pauseProject,
} from '../api/projects';
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
    updateTask,
    updateAgent,
    addArtifact,
    updateArtifact: updateArtifactInStore,
  } = useProjectStore();

  const { addEvent } = useEventStore();

  // SSE 事件处理器
  const handleSSEEvent = useCallback(
    (event: SSEEvent) => {
      switch (event.type) {
        case 'task_started':
        case 'task_completed':
        case 'task_failed':
        case 'task_waiting_review':
          if (event.data && typeof event.data === 'object' && 'id' in event.data) {
            updateTask(event.data as import('../types').Task);
          }
          break;

        case 'task_output':
          if (event.data && typeof event.data === 'object' && 'id' in event.data) {
            const taskData = event.data as Partial<import('../types').Task> & { id: string };
            updateTask({ id: taskData.id, streaming_output: taskData.streaming_output } as import('../types').Task);
          }
          break;

        case 'agent_status_changed':
          if (event.data && typeof event.data === 'object' && 'id' in event.data) {
            updateAgent(event.data as import('../types').AgentState);
          }
          break;

        case 'artifact_created':
          if (event.data && typeof event.data === 'object' && 'id' in event.data) {
            addArtifact(event.data as import('../types').Artifact);
          }
          break;

        case 'artifact_updated':
          if (event.data && typeof event.data === 'object' && 'id' in event.data) {
            updateArtifactInStore(event.data as import('../types').Artifact);
          }
          break;

        case 'event_log':
          if (event.data && typeof event.data === 'object' && 'id' in event.data) {
            addEvent(event.data as import('../types').EventLog);
          }
          break;

        case 'project_status_changed':
          if (event.data && typeof event.data === 'object' && 'status' in event.data) {
            if (project) {
              setProject({ ...project, status: event.data.status as import('../types').ProjectStatus });
            }
          }
          break;

        default:
          break;
      }
    },
    [updateTask, updateAgent, addArtifact, updateArtifactInStore, addEvent, project, setProject]
  );

  // 订阅 SSE 事件
  useSSE(handleSSEEvent, {
    projectId: projectId || '',
    enabled: !!projectId,
  });

  // 加载项目数据
  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getProject(projectId);
      setProject(data);
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
      setProject(data);
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
      setProject(data);
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
