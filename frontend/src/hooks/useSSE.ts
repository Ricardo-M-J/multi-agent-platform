import { useEffect, useRef, useCallback, useState } from 'react';
import type { SSEEvent, SSEEventType } from '../types';

type SSEHandler = (event: SSEEvent) => void;

interface UseSSEOptions {
  /** 项目 ID */
  projectId: string;
  /** 是否自动连接 */
  enabled?: boolean;
  /** 自定义 SSE URL（可选） */
  url?: string;
}

interface UseSSEReturn {
  /** 是否已连接 */
  isConnected: boolean;
  /** 最后收到的错误 */
  lastError: string | null;
  /** 手动重连 */
  reconnect: () => void;
}

/**
 * SSE 事件流 Hook
 * 用于订阅项目实时事件
 */
export function useSSE(
  handlers: Record<SSEEventType, SSEHandler> | ((event: SSEEvent) => void),
  options: UseSSEOptions
): UseSSEReturn {
  const { projectId, enabled = true, url } = options;
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    // 先关闭已有连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sseUrl =
      url ||
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'}/projects/${projectId}/events`;

    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setLastError(null);
      console.log('[SSE] 已连接:', sseUrl);
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setLastError('SSE 连接中断');
      console.error('[SSE] 连接错误');
    };

    // 监听所有自定义事件类型
    const eventTypes: SSEEventType[] = [
      'task_started',
      'task_completed',
      'task_failed',
      'task_output',
      'task_waiting_review',
      'agent_status_changed',
      'artifact_created',
      'artifact_updated',
      'event_log',
      'project_status_changed',
      'error',
    ];

    eventTypes.forEach((eventType) => {
      eventSource.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const data: SSEEvent = JSON.parse(e.data);
          const currentHandlers = handlersRef.current;

          if (typeof currentHandlers === 'function') {
            currentHandlers(data);
          } else if (currentHandlers[eventType]) {
            currentHandlers[eventType](data);
          }
        } catch (err) {
          console.error(`[SSE] 解析 ${eventType} 事件失败:`, err);
        }
      });
    });
  }, [projectId, url]);

  useEffect(() => {
    if (!enabled || !projectId) return;

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnected(false);
      }
    };
  }, [connect, enabled, projectId]);

  const reconnect = useCallback(() => {
    setLastError(null);
    connect();
  }, [connect]);

  return { isConnected, lastError, reconnect };
}

export default useSSE;
