import { Bot, Wifi, WifiOff } from 'lucide-react';
import type { AgentState } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

interface AgentStatusCardProps {
  agent: AgentState;
}

export function AgentStatusCard({ agent }: AgentStatusCardProps) {
  return (
    <div className="agent-status-card">
      <div className="agent-card-header">
        <div className="agent-avatar">
          {agent.status === 'busy' ? (
            <Bot size={18} />
          ) : agent.status === 'offline' ? (
            <WifiOff size={18} />
          ) : (
            <Wifi size={18} />
          )}
        </div>
        <div className="agent-info">
          <div className="agent-name">{agent.name}</div>
          <div className="agent-role">{agent.role}</div>
        </div>
        <StatusBadge status={agent.status} size="sm" />
      </div>

      <div className="agent-card-body">
        {agent.current_task_id && (
          <div className="agent-detail">
            <span className="detail-label">当前任务</span>
            <span className="detail-value task-id">
              {agent.current_task_id.slice(0, 12)}...
            </span>
          </div>
        )}

        {agent.model && (
          <div className="agent-detail">
            <span className="detail-label">模型</span>
            <span className="detail-value">{agent.model}</span>
          </div>
        )}

        {(agent.capabilities?.length ?? 0) > 0 && (
          <div className="agent-capabilities">
            {agent.capabilities.map((cap) => (
              <span key={cap} className="capability-tag">
                {cap}
              </span>
            ))}
          </div>
        )}

        {agent.last_active_at && (
          <div className="agent-detail">
            <span className="detail-label">最后活跃</span>
            <span className="detail-value">
              {new Date(agent.last_active_at).toLocaleTimeString('zh-CN')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentStatusCard;
