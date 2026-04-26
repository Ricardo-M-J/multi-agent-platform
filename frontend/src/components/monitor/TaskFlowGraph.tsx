import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  MarkerType,
  ConnectionLineType,
  Handle,
  Position,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Task, TaskStatus } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

// ============================================================
// 任务节点颜色配置
// ============================================================

const nodeStatusColors: Record<TaskStatus, string> = {
  pending: '#475569',
  running: '#22c55e',
  waiting_review: '#f59e0b',
  approved: '#3b82f6',
  rejected: '#ef4444',
  completed: '#3b82f6',
  failed: '#ef4444',
  cancelled: '#6b7280',
};

// ============================================================
// 自定义任务节点
// ============================================================

interface TaskNodeData {
  task: Task;
  isSelected: boolean;
  onSelect: (taskId: string) => void;
  [key: string]: unknown;
}

function TaskNode({ data }: NodeProps) {
  const nodeData = data as unknown as TaskNodeData;
  const { task, isSelected, onSelect } = nodeData;
  const borderColor = nodeStatusColors[task.status] || '#475569';
  const isRunning = task.status === 'running';

  return (
    <div
      onClick={() => onSelect(task.id)}
      style={{
        padding: '12px 16px',
        borderRadius: '10px',
        backgroundColor: isSelected
          ? 'rgba(59, 130, 246, 0.15)'
          : 'rgba(30, 41, 59, 0.95)',
        border: `2px solid ${isSelected ? '#3b82f6' : borderColor}`,
        minWidth: '180px',
        maxWidth: '240px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: isRunning
          ? `0 0 12px ${borderColor}40`
          : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} />

      <div style={{ marginBottom: '6px' }}>
        <StatusBadge status={task.status} size="sm" />
      </div>

      <div
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#f1f5f9',
          marginBottom: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {task.title}
      </div>

      {task.agent_id && (
        <div
          style={{
            fontSize: '11px',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isRunning ? '#22c55e' : '#64748b',
            }}
          />
          智能体: {task.agent_id.slice(0, 8)}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { taskNode: TaskNode };

// ============================================================
// TaskFlowGraph 主组件
// ============================================================

interface TaskFlowGraphProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}

export function TaskFlowGraph({
  tasks,
  selectedTaskId,
  onSelectTask,
}: TaskFlowGraphProps) {
  // 构建 React Flow 节点
  const nodes: Node[] = useMemo(() => {
    return tasks.map((task, index) => ({
      id: task.id,
      type: 'taskNode',
      position: { x: 0, y: index * 120 },
      data: {
        task,
        isSelected: task.id === selectedTaskId,
        onSelect: onSelectTask,
      } as Record<string, unknown>,
    }));
  }, [tasks, selectedTaskId, onSelectTask]);

  // 构建 React Flow 边（依赖关系）
  const edges: Edge[] = useMemo(() => {
    return tasks.flatMap((task) =>
      task.dependencies.map((depId) => ({
        id: `${depId}-${task.id}`,
        source: depId,
        target: task.id,
        animated: task.status === 'running',
        style: {
          stroke: '#475569',
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#475569',
        },
        type: ConnectionLineType.SmoothStep,
      }))
    );
  }, [tasks]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectTask(node.id);
    },
    [onSelectTask]
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="rgba(255, 255, 255, 0.05)"
          gap={20}
          size={1}
        />
        <Controls
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        />
        <MiniMap
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
          nodeColor={(node) => {
            const data = node.data as unknown as TaskNodeData;
            return nodeStatusColors[data.task.status] || '#475569';
          }}
          maskColor="rgba(0, 0, 0, 0.5)"
        />
      </ReactFlow>
    </div>
  );
}

export default TaskFlowGraph;
