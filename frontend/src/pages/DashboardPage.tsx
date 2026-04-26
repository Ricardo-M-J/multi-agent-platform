import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  FolderOpen,
  Play,
  Clock,
  CheckCircle,
  AlertCircle,
  Trash2,
  Search,
} from 'lucide-react';
import { getProjects, createProject, deleteProject } from '../api/projects';
import type { Project, CreateProjectRequest } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

/**
 * 项目列表页面（仪表盘）
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newProject, setNewProject] = useState<CreateProjectRequest>({
    name: '',
    description: '',
  });

  // 加载项目列表
  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getProjects({ page: 1, page_size: 50 });
      setProjects(data.items);
    } catch (err) {
      console.error('加载项目列表失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // 创建项目
  const handleCreate = async () => {
    if (!newProject.name.trim()) return;
    try {
      const project = await createProject(newProject);
      setProjects((prev) => [project, ...prev]);
      setShowCreateDialog(false);
      setNewProject({ name: '', description: '' });
      navigate(`/monitor/${project.id}`);
    } catch (err) {
      console.error('创建项目失败:', err);
    }
  };

  // 删除项目
  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('确定要删除此项目吗？')) return;
    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error('删除项目失败:', err);
    }
  };

  // 过滤项目
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 统计
  const stats = {
    total: projects.length,
    running: projects.filter((p) => p.status === 'running').length,
    completed: projects.filter((p) => p.status === 'completed').length,
    failed: projects.filter((p) => p.status === 'failed').length,
  };

  return (
    <div className="dashboard-page">
      {/* 统计卡片 */}
      <div className="stats-row">
        <div className="stat-card">
          <FolderOpen size={20} />
          <div className="stat-info">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">总项目</span>
          </div>
        </div>
        <div className="stat-card stat-running">
          <Play size={20} />
          <div className="stat-info">
            <span className="stat-value">{stats.running}</span>
            <span className="stat-label">运行中</span>
          </div>
        </div>
        <div className="stat-card stat-completed">
          <CheckCircle size={20} />
          <div className="stat-info">
            <span className="stat-value">{stats.completed}</span>
            <span className="stat-label">已完成</span>
          </div>
        </div>
        <div className="stat-card stat-failed">
          <AlertCircle size={20} />
          <div className="stat-info">
            <span className="stat-value">{stats.failed}</span>
            <span className="stat-label">失败</span>
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="toolbar">
        <div className="toolbar-left">
          <h2 className="page-title">项目列表</h2>
        </div>
        <div className="toolbar-right">
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="搜索项目..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus size={16} />
            <span>新建项目</span>
          </button>
        </div>
      </div>

      {/* 项目列表 */}
      <div className="project-list">
        {isLoading ? (
          <div className="loading-state">加载中...</div>
        ) : filteredProjects.length === 0 ? (
          <div className="empty-state">
            <FolderOpen size={48} />
            <p>{searchQuery ? '未找到匹配的项目' : '暂无项目，点击"新建项目"开始'}</p>
          </div>
        ) : (
          filteredProjects.map((project) => (
            <div
              key={project.id}
              className="project-card"
              onClick={() => navigate(`/monitor/${project.id}`)}
            >
              <div className="project-card-header">
                <h3 className="project-name">{project.name}</h3>
                <StatusBadge status={project.status} />
              </div>
              <p className="project-description">{project.description}</p>
              <div className="project-card-footer">
                <div className="project-meta">
                  <Clock size={12} />
                  <span>
                    创建于 {new Date(project.created_at).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                <div className="project-meta">
                  <span>{project.tasks.length} 个任务</span>
                  <span>{project.agents.length} 个智能体</span>
                </div>
              </div>
              <button
                className="btn-icon btn-delete"
                onClick={(e) => handleDelete(project.id, e)}
                title="删除项目"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* 创建项目对话框 */}
      {showCreateDialog && (
        <div className="modal-overlay" onClick={() => setShowCreateDialog(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>新建项目</h3>
              <button
                className="btn-icon"
                onClick={() => setShowCreateDialog(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">项目名称</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="输入项目名称"
                  value={newProject.name}
                  onChange={(e) =>
                    setNewProject({ ...newProject, name: e.target.value })
                  }
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">项目描述</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="输入项目描述"
                  value={newProject.description}
                  onChange={(e) =>
                    setNewProject({ ...newProject, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCreateDialog(false)}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={!newProject.name.trim()}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
