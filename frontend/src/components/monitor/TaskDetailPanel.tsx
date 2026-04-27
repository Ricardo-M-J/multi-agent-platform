import { FileText, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import type { Task } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { StreamingText } from '../common/StreamingText';

interface TaskDetailPanelProps {
  task: Task | null;
}

export function TaskDetailPanel({ task }: TaskDetailPanelProps) {
  if (!task) {
    return (
      <div className="task-detail-panel empty">
        <FileText size={32} />
        <p>选择一个任务查看详情</p>
      </div>
    );
  }

  const isStreaming = task.status === 'running';

  return (
    <div className="task-detail-panel">
      <div className="panel-header">
        <h3 className="panel-title">{task.title}</h3>
        <StatusBadge status={task.status} />
      </div>

      <div className="panel-body">
        <div className="detail-section">
          <h4 className="section-label">任务描述</h4>
          <p className="section-content">{task.description}</p>
        </div>

        <div className="detail-row">
          <div className="detail-item">
            <h4 className="section-label">状态</h4>
            <StatusBadge status={task.status} />
          </div>
          {task.assigned_agent && (
            <div className="detail-item">
              <h4 className="section-label">执行智能体</h4>
              <span className="detail-value">{task.assigned_agent}</span>
            </div>
          )}
        </div>

        {(task.dependencies?.length ?? 0) > 0 && (
          <div className="detail-section">
            <h4 className="section-label">依赖任务</h4>
            <div className="dependency-list">
              {(task.dependencies ?? []).map((depId) => (
                <span key={depId} className="dependency-tag">
                  {depId.slice(0, 8)}...
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="detail-row">
          {task.started_at && (
            <div className="detail-item">
              <h4 className="section-label">
                <Clock size={12} /> 开始时间
              </h4>
              <span className="detail-value">
                {new Date(task.started_at).toLocaleString('zh-CN')}
              </span>
            </div>
          )}
          {task.completed_at && (
            <div className="detail-item">
              <h4 className="section-label">
                <CheckCircle size={12} /> 完成时间
              </h4>
              <span className="detail-value">
                {new Date(task.completed_at).toLocaleString('zh-CN')}
              </span>
            </div>
          )}
        </div>

        {/* 流式输出 */}
        <div className="detail-section">
          <h4 className="section-label">
            {isStreaming ? '实时输出' : '输出结果'}
          </h4>
          <StreamingText
            text={task.streaming_output || task.result || ''}
            isStreaming={isStreaming}
            maxHeight="300px"
          />
        </div>

        {/* 错误信息 */}
        {task.error && (
          <div className="detail-section error-section">
            <h4 className="section-label">
              <AlertTriangle size={12} /> 错误信息
            </h4>
            <div className="error-content">{task.error}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TaskDetailPanel;
