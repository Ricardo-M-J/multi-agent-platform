import type { TaskStatus, AgentStatus, ProjectStatus } from '../../types';

interface StatusBadgeProps {
  status: TaskStatus | AgentStatus | ProjectStatus;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  // 项目状态
  created: { label: '已创建', color: '#94a3b8', bgColor: 'rgba(148,163,184,0.15)' },
  running: { label: '运行中', color: '#22c55e', bgColor: 'rgba(34,197,94,0.15)' },
  paused: { label: '已暂停', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.15)' },
  completed: { label: '已完成', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.15)' },
  failed: { label: '失败', color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)' },

  // 任务状态
  pending: { label: '等待中', color: '#94a3b8', bgColor: 'rgba(148,163,184,0.15)' },
  waiting_review: { label: '待审核', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.15)' },
  approved: { label: '已通过', color: '#22c55e', bgColor: 'rgba(34,197,94,0.15)' },
  rejected: { label: '已拒绝', color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)' },
  cancelled: { label: '已取消', color: '#6b7280', bgColor: 'rgba(107,114,128,0.15)' },

  // 智能体状态
  idle: { label: '空闲', color: '#94a3b8', bgColor: 'rgba(148,163,184,0.15)' },
  busy: { label: '忙碌', color: '#22c55e', bgColor: 'rgba(34,197,94,0.15)' },
  error: { label: '错误', color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)' },
  offline: { label: '离线', color: '#6b7280', bgColor: 'rgba(107,114,128,0.15)' },
};

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { fontSize: '11px', padding: '2px 8px', borderRadius: '4px' },
  md: { fontSize: '12px', padding: '3px 10px', borderRadius: '6px' },
  lg: { fontSize: '14px', padding: '4px 14px', borderRadius: '8px' },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    color: '#94a3b8',
    bgColor: 'rgba(148,163,184,0.15)',
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        color: config.color,
        backgroundColor: config.bgColor,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        ...sizeStyles[size],
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: config.color,
          flexShrink: 0,
        }}
      />
      {config.label}
    </span>
  );
}

export default StatusBadge;
