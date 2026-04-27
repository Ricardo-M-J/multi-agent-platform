import type { WSMessage, WSMessageType } from '../types';

// Auto-derive WebSocket URL from API base URL
function getWsBaseUrl(): string {
  const explicit = import.meta.env.VITE_WS_BASE_URL;
  if (explicit) return explicit;

  const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
  if (apiBase.startsWith('http')) {
    // Convert http(s)://host/api -> ws(s)://host/ws
    return apiBase.replace(/^http/, 'ws').replace(/\/api$/, '/ws');
  }
  // Relative path: use current page origin
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

const WS_BASE_URL = getWsBaseUrl();

type MessageHandler = (message: WSMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private projectId: string | null = null;

  constructor() {
    this.url = WS_BASE_URL;
  }

  /** 连接 WebSocket */
  connect(projectId: string): void {
    this.projectId = projectId;
    const fullUrl = `${this.url}/${projectId}`;

    try {
      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => {
        console.log('[WS] 已连接:', fullUrl);
        this.reconnectAttempts = 0;
        // 发送订阅消息
        this.send({ type: 'subscribe', payload: { project_id: projectId }, timestamp: new Date().toISOString() });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          this.dispatch(message);
        } catch (err) {
          console.error('[WS] 解析消息失败:', err);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[WS] 连接关闭:', event.code, event.reason);
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WS] 连接错误:', error);
      };
    } catch (err) {
      console.error('[WS] 创建连接失败:', err);
      this.scheduleReconnect();
    }
  }

  /** 发送消息 */
  send(message: WSMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WS] 连接未就绪，无法发送消息');
    }
  }

  /** 注册消息处理器 */
  on(type: WSMessageType, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // 返回取消注册函数
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  /** 分发消息到对应处理器 */
  private dispatch(message: WSMessage): void {
    const typeHandlers = this.handlers.get(message.type);
    if (typeHandlers) {
      typeHandlers.forEach((handler) => handler(message));
    }

    // 通用处理器
    const allHandlers = this.handlers.get('*' as WSMessageType);
    if (allHandlers) {
      allHandlers.forEach((handler) => handler(message));
    }
  }

  /** 自动重连 */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] 已达最大重连次数，停止重连');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[WS] ${delay}ms 后尝试第 ${this.reconnectAttempts} 次重连...`);

    this.reconnectTimer = setTimeout(() => {
      if (this.projectId) {
        this.connect(this.projectId);
      }
    }, delay);
  }

  /** 断开连接 */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // 阻止自动重连

    if (this.ws) {
      this.ws.close(1000, '用户主动断开');
      this.ws = null;
    }
    this.projectId = null;
  }

  /** 获取连接状态 */
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// 单例实例
export const wsClient = new WebSocketClient();
