import { useCallback, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  RefreshCw,
  FileText,
  CheckCircle2,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { useProject } from '../hooks/useProject';
import { useProjectStore } from '../store/projectStore';
import { reviewTask, reviewTaskSimple } from '../api/tasks';
import { getPlan, updatePlanTask, deletePlanTask, addPlanTask, confirmPlan as confirmPlanFromPlans } from '../api/plans';
import type { PlanTask } from '../api/plans';
import { getArtifacts } from '../api/artifacts';
import type { TaskReviewRequest, Artifact } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { TaskFlowGraph } from '../components/monitor/TaskFlowGraph';
import { AgentStatusCard } from '../components/monitor/AgentStatusCard';
import { TaskDetailPanel } from '../components/monitor/TaskDetailPanel';
import { ReviewActions } from '../components/monitor/ReviewActions';
import { TaskEditDialog } from '../components/monitor/TaskEditDialog';
import { EventLog } from '../components/log/EventLog';
import { LogFilter } from '../components/log/LogFilter';

/**
 * 项目监控页面
 * 包含任务 DAG、智能体状态、任务详情、事件日志
 */
export function ProjectMonitorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project, isLoading, error, fetchProject, start, pause } = useProject(projectId);
  const { selectedTaskId, setSelectedTaskId } = useProjectStore();

  // 组件卸载时清除项目数据，避免切换页面后残留旧数据
  useEffect(() => {
    return () => {
      useProjectStore.getState().clearProject();
    };
  }, []);

  // 底部面板标签页状态
  const [bottomTab, setBottomTab] = useState<'events' | 'artifacts'>('events');
  // 产出物数据
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [expandedArtifactId, setExpandedArtifactId] = useState<string | null>(null);

  // 确认计划状态
  const [isConfirmingPlan, setIsConfirmingPlan] = useState(false);
  // 审核操作状态
  const [reviewComment, setReviewComment] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);

  // 计划编辑模式状态
  const [planTasks, setPlanTasks] = useState<PlanTask[]>([]);
  const [showTaskEdit, setShowTaskEdit] = useState(false);
  const [editingTask, setEditingTask] = useState<PlanTask | null>(null);

  const selectedTask = project?.tasks.find((t) => t.id === selectedTaskId) || null;

  // 是否有 pending 状态的子任务
  const hasPendingTasks = (project?.tasks ?? []).some((t) => t.status === 'pending');

  // 当有 pending 任务时加载计划；也尝试加载计划来判断是否处于计划编辑模式
  useEffect(() => {
    if (projectId) {
      getPlan(projectId)
        .then((data) => {
          // plan API 返回非空数据说明处于计划编辑模式
          if (data.length > 0) {
            setPlanTasks(data);
          } else if (!hasPendingTasks) {
            setPlanTasks([]);
          }
        })
        .catch(() => {
          // plan API 失败时，根据 hasPendingTasks 决定
          if (!hasPendingTasks) {
            setPlanTasks([]);
          }
        });
    }
  }, [projectId, hasPendingTasks]);

  // Agent 选项列表（用于任务编辑对话框）
  const agentOptions = (project?.agents ?? []).map((a) => a.agent_name || a.name || '');

  // 编辑计划任务
  const handleEditPlanTask = useCallback((task: PlanTask) => {
    setEditingTask(task);
    setShowTaskEdit(true);
  }, []);

  // 保存计划任务编辑
  const handleSavePlanTask = useCallback(
    async (taskId: string, data: Partial<PlanTask>) => {
      if (!projectId) return;
      try {
        await updatePlanTask(projectId, taskId, data);
        setShowTaskEdit(false);
        setEditingTask(null);
        // 刷新计划
        const updated = await getPlan(projectId);
        setPlanTasks(updated);
        // 刷新项目
        await fetchProject();
      } catch (err) {
        console.error('更新计划任务失败:', err);
        console.log('更新任务失败，请重试');
      }
    },
    [projectId, fetchProject]
  );

  // 删除计划任务
  const handleDeletePlanTask = useCallback(
    async (taskId: string) => {
      if (!projectId) return;
      if (!window.confirm('确定要删除此任务吗？')) return;
      try {
        await deletePlanTask(projectId, taskId);
        const updated = await getPlan(projectId);
        setPlanTasks(updated);
        await fetchProject();
      } catch (err) {
        console.error('删除计划任务失败:', err);
        console.log('删除任务失败，请重试');
      }
    },
    [projectId, fetchProject]
  );

  // 添加子任务
  const handleAddPlanTask = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await addPlanTask(projectId, {
        title: '新任务',
        description: null,
        assigned_agent: null,
        priority: 5,
        requires_human_review: false,
      });
      const updated = await getPlan(projectId);
      setPlanTasks(updated);
      // 打开编辑对话框编辑新任务
      const newTask = updated.find((t) => t.id === result.task_id);
      if (newTask) {
        handleEditPlanTask(newTask);
      }
    } catch (err) {
      console.error('添加任务失败:', err);
      console.log('添加任务失败，请重试');
    }
  }, [projectId, handleEditPlanTask]);

  // 确认计划并执行（使用 plans API）
  const handleConfirmPlanFromEditor = useCallback(async () => {
    if (!projectId) return;
    setIsConfirmingPlan(true);
    try {
      const result = await confirmPlanFromPlans(projectId);
      setPlanTasks([]);
      await fetchProject();
      console.log(`计划已确认，共 ${result.count} 个任务已更新`);
    } catch (err) {
      console.error('确认计划失败:', err);
      console.log('确认计划失败，请重试');
    } finally {
      setIsConfirmingPlan(false);
    }
  }, [projectId, fetchProject]);

  // 加载产出物
  const fetchArtifacts = useCallback(async () => {
    if (!projectId) return;
    setArtifactsLoading(true);
    try {
      const data = await getArtifacts(projectId);
      setArtifacts(data);
    } catch (err) {
      console.error('加载产出物失败:', err);
    } finally {
      setArtifactsLoading(false);
    }
  }, [projectId]);

  // 切换到产出物标签时加载数据
  useEffect(() => {
    if (bottomTab === 'artifacts' && artifacts.length === 0) {
      fetchArtifacts();
    }
  }, [bottomTab, artifacts.length, fetchArtifacts]);

  // 切换产出物展开/收起
  const toggleArtifact = useCallback((artifactId: string) => {
    setExpandedArtifactId((prev) => (prev === artifactId ? null : artifactId));
  }, []);

  // 格式化产出物内容为 JSON
  const formatContent = (content: string): string => {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  };

  // 审核任务
  const handleReview = useCallback(
    async (projId: string, taskId: string, data: TaskReviewRequest) => {
      await reviewTask(projId, taskId, data);
      // 刷新项目数据
      await fetchProject();
    },
    [fetchProject]
  );

  // 审核操作（通过/退回/修改要求）
  const handleReviewAction = useCallback(
    async (action: 'approve' | 'reject' | 'modify') => {
      if (!projectId || !selectedTask) return;
      setIsReviewing(true);
      setReviewSuccessMsg(null);
      try {
        await reviewTaskSimple(projectId, selectedTask.id, action, reviewComment);
        const actionLabels: Record<string, string> = {
          approve: '通过',
          reject: '退回',
          modify: '修改要求',
        };
        setReviewSuccessMsg(`任务已${actionLabels[action]}！`);
        setReviewComment('');
        // 刷新项目数据
        await fetchProject();
      } catch (err) {
        console.error('审核操作失败:', err);
        console.log('审核操作失败，请重试');
      } finally {
        setIsReviewing(false);
      }
    },
    [projectId, selectedTask, reviewComment, fetchProject]
  );

  if (isLoading) {
    return (
      <div className="monitor-page">
        <div className="loading-state">加载项目数据中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="monitor-page">
        <div className="error-state">
          <p>加载失败: {error}</p>
          <button className="btn btn-primary" onClick={fetchProject}>
            <RefreshCw size={14} />
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="monitor-page">
        <div className="empty-state">
          <p>未找到项目</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            返回项目列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="monitor-page">
      {/* 顶部工具栏 */}
      <div className="monitor-toolbar">
        <div className="toolbar-left">
          <button
            className="btn btn-ghost"
            onClick={() => navigate('/')}
          >
            <ArrowLeft size={16} />
            <span>返回</span>
          </button>
          <div className="project-title-section">
            <h2 className="project-title">{project.name}</h2>
            <StatusBadge status={project.status} />
          </div>
        </div>
        <div className="toolbar-right">
          <button
            className="btn btn-secondary"
            onClick={fetchProject}
            title="刷新"
          >
            <RefreshCw size={14} />
          </button>
          {hasPendingTasks && (
            <button
              className="btn btn-confirm-plan"
              onClick={handleConfirmPlanFromEditor}
              disabled={isConfirmingPlan}
              title="确认计划"
            >
              <CheckCircle2 size={14} />
              <span>{isConfirmingPlan ? '确认中...' : '确认计划'}</span>
            </button>
          )}
          {project.status === 'created' || project.status === 'paused' ? (
            <button className="btn btn-primary" onClick={start}>
              <Play size={14} />
              <span>启动</span>
            </button>
          ) : project.status === 'running' ? (
            <button className="btn btn-warning" onClick={pause}>
              <Pause size={14} />
              <span>暂停</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* 主内容区域 - 网格布局 */}
      <div className="monitor-grid">
        {/* 左侧 - 任务 DAG / 计划编辑 */}
        <div className="grid-panel panel-dag">
          <div className="panel-header-bar">
            <h3>{hasPendingTasks ? '执行计划' : '任务流程图'}</h3>
            <span className="task-count">{hasPendingTasks ? planTasks.length : project.tasks?.length ?? 0} 个任务</span>
          </div>
          <div className="panel-content">
            {hasPendingTasks ? (
              <div className="plan-editor">
                {/* 提示条 */}
                <div className="plan-editor-notice">
                  <AlertTriangle size={14} />
                  <span>Manager 已生成执行计划，请审核后确认</span>
                </div>

                {/* 任务列表 */}
                <div className="plan-task-list">
                  {planTasks.length === 0 ? (
                    <div className="empty-mini">暂无计划任务</div>
                  ) : (
                    planTasks.map((task) => (
                      <div key={task.id} className="plan-task-item">
                        <div className="plan-task-info">
                          <span className="plan-task-title">{task.title}</span>
                          {task.assigned_agent && (
                            <span className="plan-task-agent">{task.assigned_agent}</span>
                          )}
                        </div>
                        <div className="task-actions">
                          <button
                            className="btn-icon"
                            onClick={() => handleEditPlanTask(task)}
                            title="编辑"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => handleDeletePlanTask(task.id)}
                            title="删除"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 工具栏 */}
                <div className="plan-toolbar">
                  <button className="btn btn-secondary" onClick={handleAddPlanTask}>
                    <Plus size={14} />
                    <span>添加子任务</span>
                  </button>
                  <button
                    className="btn btn-confirm-plan"
                    onClick={handleConfirmPlanFromEditor}
                    disabled={isConfirmingPlan || planTasks.length === 0}
                  >
                    <CheckCircle2 size={14} />
                    <span>{isConfirmingPlan ? '确认中...' : '确认计划并执行'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <TaskFlowGraph
                tasks={project.tasks ?? []}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
              />
            )}
          </div>
        </div>

        {/* 中间 - 任务详情 + 审核操作 */}
        <div className="grid-panel panel-detail">
          <div className="panel-header-bar">
            <h3>任务详情</h3>
          </div>
          <div className="panel-content">
            <TaskDetailPanel task={selectedTask} />
            {selectedTask && selectedTask.status === 'waiting_review' && (
              <ReviewActions
                taskId={selectedTask.id}
                projectId={project.id}
                onReview={handleReview}
              />
            )}
            {selectedTask && selectedTask.status === 'review' && (
              <div className="review-action-card">
                <h4 className="review-action-title">任务审核</h4>
                <div className="review-action-body">
                  <textarea
                    className="review-comment-input"
                    placeholder="请输入审核意见..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={3}
                    disabled={isReviewing}
                  />
                  {reviewSuccessMsg && (
                    <div className="review-success-msg">{reviewSuccessMsg}</div>
                  )}
                  <div className="review-action-buttons">
                    <button
                      className="btn btn-approve-action"
                      onClick={() => handleReviewAction('approve')}
                      disabled={isReviewing}
                    >
                      <span>通过</span>
                    </button>
                    <button
                      className="btn btn-reject-action"
                      onClick={() => handleReviewAction('reject')}
                      disabled={isReviewing}
                    >
                      <span>退回</span>
                    </button>
                    <button
                      className="btn btn-modify-action"
                      onClick={() => handleReviewAction('modify')}
                      disabled={isReviewing}
                    >
                      <span>修改要求</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右侧 - 智能体状态 */}
        <div className="grid-panel panel-agents">
          <div className="panel-header-bar">
            <h3>智能体状态</h3>
            <span className="agent-count">{project.agents?.length ?? 0} 个智能体</span>
          </div>
          <div className="panel-content agents-list">
            {(project.agents?.length ?? 0) === 0 ? (
              <div className="empty-mini">暂无智能体</div>
            ) : (
              (project.agents ?? []).map((agent) => (
                <AgentStatusCard key={agent.id} agent={agent} />
              ))
            )}
          </div>
        </div>

        {/* 底部 - 事件日志 / 产出物（可切换标签页） */}
        <div className="grid-panel panel-log">
          <div className="panel-header-bar">
            <div className="panel-tabs">
              <button
                className={`panel-tab ${bottomTab === 'events' ? 'active' : ''}`}
                onClick={() => setBottomTab('events')}
              >
                事件日志
              </button>
              <button
                className={`panel-tab ${bottomTab === 'artifacts' ? 'active' : ''}`}
                onClick={() => setBottomTab('artifacts')}
              >
                产出物
                {artifacts.length > 0 && (
                  <span className="artifact-count">{artifacts.length}</span>
                )}
              </button>
            </div>
            {bottomTab === 'events' && <LogFilter />}
            {bottomTab === 'artifacts' && (
              <button
                className="btn btn-ghost"
                onClick={fetchArtifacts}
                title="刷新产出物"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>
          <div className="panel-content">
            {bottomTab === 'events' && <EventLog />}
            {bottomTab === 'artifacts' && (
              <div className="artifacts-panel">
                {artifactsLoading ? (
                  <div className="empty-mini">加载产出物中...</div>
                ) : artifacts.length === 0 ? (
                  <div className="empty-mini">暂无产出物</div>
                ) : (
                  <div className="artifacts-list">
                    {artifacts.map((artifact) => (
                      <div key={artifact.id} className="artifact-item">
                        <div
                          className="artifact-item-header"
                          onClick={() => toggleArtifact(artifact.id)}
                        >
                          <div className="artifact-item-icon">
                            <FileText size={14} />
                          </div>
                          <div className="artifact-item-info">
                            <span className="artifact-item-title">
                              {artifact.title || '未命名产出物'}
                            </span>
                            <span className="artifact-item-agent">
                              {artifact.agent_name || '系统'}
                            </span>
                          </div>
                          <span className={`artifact-expand-icon ${expandedArtifactId === artifact.id ? 'expanded' : ''}`}>
                            &#9662;
                          </span>
                        </div>
                        {expandedArtifactId === artifact.id && (
                          <div className="artifact-item-content">
                            <pre className="artifact-content-json">
                              {formatContent(artifact.content)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 任务编辑对话框 */}
      <TaskEditDialog
        isOpen={showTaskEdit}
        task={editingTask}
        agentOptions={agentOptions}
        onSave={handleSavePlanTask}
        onClose={() => {
          setShowTaskEdit(false);
          setEditingTask(null);
        }}
      />
    </div>
  );
}

export default ProjectMonitorPage;
