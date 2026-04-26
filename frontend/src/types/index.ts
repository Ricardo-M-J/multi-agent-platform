// ============================================================
// 多智能体平台 - 前端类型定义
// ============================================================

/** 项目状态 */
export type ProjectStatus = 'created' | 'running' | 'paused' | 'completed' | 'failed';

/** 任务状态 */
export type TaskStatus =
  | 'pending'
  | 'running'
  | 'waiting_review'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** 智能体状态 */
export type AgentStatus = 'idle' | 'busy' | 'error' | 'offline';

/** 事件日志级别 */
export type EventLevel = 'info' | 'warn' | 'error' | 'debug';

/** 事件来源 */
export type EventSource = 'system' | 'agent' | 'task' | 'human';

// ============================================================
// 核心实体
// ============================================================

/** 项目 */
export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  config: ProjectConfig;
  tasks: Task[];
  agents: AgentState[];
  artifacts: Artifact[];
  created_at: string;
  updated_at: string;
}

/** 项目配置 */
export interface ProjectConfig {
  max_parallel_agents: number;
  enable_human_review: boolean;
  retry_on_failure: boolean;
  max_retries: number;
  timeout_seconds: number;
}

/** 任务 */
export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  agent_id?: string;
  dependencies: string[]; // 依赖的任务 ID 列表
  input_artifacts: string[];
  output_artifacts: string[];
  result?: string;
  error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  streaming_output?: string;
}

/** 智能体状态 */
export interface AgentState {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  current_task_id?: string;
  capabilities: string[];
  model?: string;
  last_active_at?: string;
  metadata?: Record<string, unknown>;
}

/** 产出物 */
export interface Artifact {
  id: string;
  project_id: string;
  task_id: string;
  name: string;
  type: 'text' | 'code' | 'image' | 'document' | 'data';
  content: string;
  version: number;
  approved: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// 事件与消息
// ============================================================

/** 事件日志 */
export interface EventLog {
  id: string;
  project_id: string;
  timestamp: string;
  level: EventLevel;
  source: EventSource;
  source_id?: string;
  message: string;
  details?: Record<string, unknown>;
}

/** SSE 事件 */
export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: string;
  project_id?: string;
}

export type SSEEventType =
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_output'
  | 'task_waiting_review'
  | 'agent_status_changed'
  | 'artifact_created'
  | 'artifact_updated'
  | 'event_log'
  | 'project_status_changed'
  | 'error';

/** WebSocket 消息 */
export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
  project_id?: string;
  timestamp: string;
}

export type WSMessageType =
  | 'subscribe'
  | 'unsubscribe'
  | 'task_update'
  | 'agent_update'
  | 'artifact_update'
  | 'event'
  | 'pong';

// ============================================================
// API 请求/响应
// ============================================================

/** 创建项目请求 */
export interface CreateProjectRequest {
  name: string;
  description: string;
  config?: Partial<ProjectConfig>;
}

/** 更新项目请求 */
export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  config?: Partial<ProjectConfig>;
}

/** 任务审核请求 */
export interface TaskReviewRequest {
  action: 'approve' | 'reject' | 'modify' | 'retry';
  comment?: string;
  modified_content?: string;
}

/** 任务重试请求 */
export interface TaskRetryRequest {
  retry_from_task_id?: string;
}

/** 分页参数 */
export interface PaginationParams {
  page: number;
  page_size: number;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

/** API 错误响应 */
export interface ApiError {
  detail: string;
  code?: string;
}

// ============================================================
// React Flow 节点/边类型扩展
// ============================================================

export interface TaskNodeData {
  task: Task;
  isSelected: boolean;
}

export interface TaskEdgeData {
  dependency: string;
}
