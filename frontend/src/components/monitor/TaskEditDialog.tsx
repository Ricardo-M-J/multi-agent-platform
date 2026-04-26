import { useState, useEffect } from 'react';
import type { PlanTask } from '../../api/plans';

interface TaskEditDialogProps {
  isOpen: boolean;
  task: PlanTask | null;
  agentOptions: string[];
  onSave: (taskId: string, data: Partial<PlanTask>) => void;
  onClose: () => void;
}

/**
 * 任务编辑对话框
 * 用于编辑计划中的子任务
 */
export function TaskEditDialog({ isOpen, task, agentOptions, onSave, onClose }: TaskEditDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedAgent, setAssignedAgent] = useState('');
  const [priority, setPriority] = useState(1);
  const [requiresHumanReview, setRequiresHumanReview] = useState(false);

  // 当 task 变化时重置表单
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setAssignedAgent(task.assigned_agent ?? '');
      setPriority(task.priority);
      setRequiresHumanReview(task.requires_human_review);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(task.id, {
      title: title.trim(),
      description: description.trim() || null,
      assigned_agent: assignedAgent || null,
      priority,
      requires_human_review: requiresHumanReview,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>编辑任务</h3>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {/* 任务标题 */}
          <div className="form-group">
            <label className="form-label">任务标题</label>
            <input
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入任务标题"
            />
          </div>

          {/* 任务描述 */}
          <div className="form-group">
            <label className="form-label">任务描述</label>
            <textarea
              className="form-input form-textarea"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入任务描述（可选）"
            />
          </div>

          {/* 分配 Agent */}
          <div className="form-group">
            <label className="form-label">分配 Agent</label>
            <select
              className="form-input"
              value={assignedAgent}
              onChange={(e) => setAssignedAgent(e.target.value)}
            >
              <option value="">-- 未分配 --</option>
              {agentOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* 优先级 */}
          <div className="form-group">
            <label className="form-label">优先级</label>
            <input
              className="form-input"
              type="number"
              min={1}
              max={10}
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 1)}
            />
          </div>

          {/* 需要人工审核 */}
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              id="requires-human-review"
              checked={requiresHumanReview}
              onChange={(e) => setRequiresHumanReview(e.target.checked)}
              style={{ accentColor: 'var(--accent-blue)', width: 16, height: 16 }}
            />
            <label htmlFor="requires-human-review" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>
              需要人工审核
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!title.trim()}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskEditDialog;
