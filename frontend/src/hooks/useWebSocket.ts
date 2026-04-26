import { useEffect, useRef, useCallback, useState } from 'react';
import { wsClient } from '../api/websocket';
import type { WSMessage, WSMessageType } from '../types';

type WSHandler = (message: WSMessage) => void;

interface UseWebSocketOptions {
  /** 项目 ID */
  projectId: string;
  /** 是否自动连接 */
  enabled?: boolean;
}

interface UseWebSocketReturn {
  /** 是否已连接 */
  isConnected: boolean;
  /** 发送消息 */
  send: (message: WSMessage) => void;
  /** 注册处理器 */
  on: (type: WSMessageType, handler: WSHandler) => () => void;
}

/**
 * WebSocket 连接 Hook
 * 用于实时双向通信
 */
export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { projectId, enabled = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef<Map<string, Set<WSHandler>>>(new Map());
  const unsubscribeFnsRef = useRef<(() => void)[]>([]);

  // 注册所有处理器
  const registerHandlers = useCallback(() => {
    // 清除旧的处理器
    unsubscribeFnsRef.current.forEach((fn) => fn());
    unsubscribeFnsRef.current = [];

    // 注册每种消息类型的处理器
    handlersRef.current.forEach((handlers, type) => {
      handlers.forEach((handler) => {
        const unsub = wsClient.on(type as WSMessageType, handler);
        unsubscribeFnsRef.current.push(unsub);
      });
    });
  }, []);

  // 连接/断开
  useEffect(() => {
    if (!enabled || !projectId) return;

    wsClient.connect(projectId);
    registerHandlers();

    // 轮询连接状态
    const interval = setInterval(() => {
      setIsConnected(wsClient.isConnected);
    }, 1000);

    return () => {
      clearInterval(interval);
      wsClient.disconnect();
    };
  }, [projectId, enabled, registerHandlers]);

  const send = useCallback(
    (message: WSMessage) => {
      wsClient.send(message);
    },
    []
  );

  const on = useCallback((type: WSMessageType, handler: WSHandler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);

    // 如果已连接，立即注册
    if (wsClient.isConnected) {
      const unsub = wsClient.on(type, handler);
      unsubscribeFnsRef.current.push(unsub);
    }

    // 返回取消注册函数
    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  return { isConnected, send, on };
}

export default useWebSocket;
