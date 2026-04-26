import { useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  RefreshCw,
} from 'lucide-react';
import { useProject } from '../hooks/useProject';
import { useProjectStore } from '../store/projectStore';
import { reviewTask } from '../api/tasks';
import type { TaskReviewRequest } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { TaskFlowGraph } from '../components/monitor/TaskFlowGraph';
import { AgentStatusCard } from '../components/monitor/AgentStatusCard';
import { TaskDetailPanel } from '../components/monitor/TaskDetailPanel';
import { ReviewActions } from '../components/monitor/ReviewActions';
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

  const selectedTask = project?.tasks.find((t) => t.id === selectedTaskId) || null;

  // 审核任务
  const handleReview = useCallback(
    async (projId: string, taskId: string, data: TaskReviewRequest) => {
      await reviewTask(projId, taskId, data);
      // 刷新项目数据
      await fetchProject();
    },
    [fetchProject]
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
        {/* 左侧 - 任务 DAG */}
        <div className="grid-panel panel-dag">
          <div className="panel-header-bar">
            <h3>任务流程图</h3>
            <span className="task-count">{project.tasks.length} 个任务</span>
          </div>
          <div className="panel-content">
            <TaskFlowGraph
              tasks={project.tasks}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
            />
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
          </div>
        </div>

        {/* 右侧 - 智能体状态 */}
        <div className="grid-panel panel-agents">
          <div className="panel-header-bar">
            <h3>智能体状态</h3>
            <span className="agent-count">{project.agents.length} 个智能体</span>
          </div>
          <div className="panel-content agents-list">
            {project.agents.length === 0 ? (
              <div className="empty-mini">暂无智能体</div>
            ) : (
              project.agents.map((agent) => (
                <AgentStatusCard key={agent.id} agent={agent} />
              ))
            )}
          </div>
        </div>

        {/* 底部 - 事件日志 */}
        <div className="grid-panel panel-log">
          <div className="panel-header-bar">
            <h3>事件日志</h3>
            <LogFilter />
          </div>
          <div className="panel-content">
            <EventLog />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectMonitorPage;
