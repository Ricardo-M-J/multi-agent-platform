import { useCallback, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { useProject } from '../hooks/useProject';
import { useProjectStore } from '../store/projectStore';
import { reviewTask } from '../api/tasks';
import { getArtifacts } from '../api/artifacts';
import type { TaskReviewRequest, Artifact } from '../types';
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

  // 底部面板标签页状态
  const [bottomTab, setBottomTab] = useState<'events' | 'artifacts'>('events');
  // 产出物数据
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [expandedArtifactId, setExpandedArtifactId] = useState<string | null>(null);

  const selectedTask = project?.tasks.find((t) => t.id === selectedTaskId) || null;

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
            <span className="task-count">{project.tasks?.length ?? 0} 个任务</span>
          </div>
          <div className="panel-content">
            <TaskFlowGraph
              tasks={project.tasks ?? []}
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
    </div>
  );
}

export default ProjectMonitorPage;
