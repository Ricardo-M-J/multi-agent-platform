// ============================================================
// 多智能体平台 - 前端类型定义
// ============================================================

/** 项目状态 */
export type ProjectStatus = 'created' | 'running' | 'paused' | 'completed' | 'failed';

/** 任务状态 */
export type TaskStatus =
  | 'pending'
  | 'claimed'
  | 'running'
  | 'in_progress'
  | 'review'
  | 'completed'
  | 'failed';

/** 智能体状态 */
export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'error';

/** 事件日志级别 */
export type EventLevel = 'info' | 'warn' | 'error' | 'debug';

/** 事件来源 */
export type EventSource = 'system' | 'agent' | 'task' | 'human';

// ============================================================
// 核心实体（与后端 API 对齐）
// ============================================================

/** 项目（后端返回的原始结构） */
export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // 以下字段由前端从独立 API 聚合
  tasks?: Task[];
  agents?: AgentState[];
  artifacts?: Artifact[];
}

/** 任务（与后端 TaskResponse 对齐） */
export interface Task {
  id: string;
  project_id: string;
  parent_task_id?: string | null;
  title: string;
  description: string | null;
  assigned_agent?: string | null;
  status: TaskStatus;
  priority: number;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  requires_human_review: boolean;
  human_feedback?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // 前端扩展字段
  dependencies?: string[];
  streaming_output?: string;
  agent_id?: string | null;
  result?: string | null;
  error?: string | null;
}

/** 智能体状态（与后端 AgentStateResponse 对齐） */
export interface AgentState {
  id: string;
  project_id: string;
  agent_name: string;
  current_task_id?: string | null;
  status: AgentStatus;
  thought_process?: string | null;
  token_usage: Record<string, unknown>;
  last_heartbeat: string;
  created_at: string;
  updated_at: string;
  // 前端兼容字段
  name?: string;
  role?: string;
  capabilities?: string[];
  model?: string;
  last_active_at?: string;
}

/** 产出物（与后端 ArtifactResponse 对齐） */
export interface Artifact {
  id: string;
  project_id: string;
  task_id?: string | null;
  agent_name?: string | null;
  artifact_type?: string | null;
  title?: string | null;
  content: string;
  version: number;
  is_final: boolean;
  created_at: string;
  // 前端兼容字段
  name?: string;
  type?: string;
  approved?: boolean;
  updated_at?: string;
}

// ============================================================
// 事件与消息
// ============================================================

/** 事件日志（与后端 EventLogResponse 对齐） */
export interface EventLog {
  id: string;
  project_id: string;
  task_id?: string | null;
  agent_name?: string | null;
  event_type?: string | null;
  event_level: string;
  content?: string | null;
  data?: Record<string, unknown>;
  created_at: string;
  // 前端兼容字段
  timestamp?: string;
  level?: string;
  source?: string;
  source_id?: string;
  message?: string;
  details?: Record<string, unknown>;
}

/** SSE 事件（与后端 SSEEvent 对齐） */
export interface SSEEvent {
  type: string;
  project_id: string;
  task_id?: string | null;
  agent_name?: string | null;
  content?: string | null;
  data: Record<string, unknown>;
}

export type SSEEventType =
  | 'task_created'
  | 'task_status_changed'
  | 'agent_thinking'
  | 'agent_output'
  | 'review_required'
  | 'task_approved'
  | 'task_rejected'
  | 'task_modified'
  | 'task_retry'
  | 'project_paused'
  | 'project_resumed'
  | 'error';

/** WebSocket 消息类型 */
export type WSMessageType = 'pause' | 'resume' | 'approve' | 'reject' | 'modify' | 'retry';

/** WebSocket 消息 */
export interface WSMessage {
  type: WSMessageType;
  project_id?: string;
  task_id?: string;
  data?: any;
}

// ============================================================
// API 请求/响应
// ============================================================

/** 创建项目请求 */
export interface CreateProjectRequest {
  name: string;
  description?: string;
  config?: Record<string, unknown>;
}

/** 更新项目请求 */
export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  config?: Record<string, unknown>;
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
