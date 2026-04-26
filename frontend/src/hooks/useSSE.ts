import { useEffect, useRef, useCallback, useState } from 'react';
import type { SSEEvent } from '../types';

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
 * 后端使用 sse-starlette，事件通过 data: JSON 格式发送
 */
export function useSSE(
  handler: SSEHandler,
  options: UseSSEOptions
): UseSSEReturn {
  const { projectId, enabled = true, url } = options;
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Use relative URL so Vite proxy handles it
    const sseUrl = url || `/api/projects/${projectId}/stream`;

    try {
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setLastError(null);
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        setLastError('SSE 连接中断');
      };

      // sse-starlette sends events as unnamed `message` events with JSON data
      eventSource.onmessage = (e: MessageEvent) => {
        try {
          const data: SSEEvent = JSON.parse(e.data);
          handlerRef.current(data);
        } catch (err) {
          console.error('[SSE] 解析事件失败:', err);
        }
      };
    } catch (err) {
      console.error('[SSE] 创建连接失败:', err);
      setLastError('SSE 连接失败');
    }
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
