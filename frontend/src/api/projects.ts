import apiClient from './client';
import type {
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
} from '../types';

/** 获取项目列表 */
export async function getProjects(): Promise<Project[]> {
  const response = await apiClient.get<Project[]>('/projects');
  return Array.isArray(response.data) ? response.data : [];
}

/** 获取单个项目详情 */
export async function getProject(projectId: string): Promise<Project> {
  const response = await apiClient.get<Project>(`/projects/${projectId}`);
  return response.data;
}

/** 创建新项目 */
export async function createProject(data: CreateProjectRequest): Promise<Project> {
  const response = await apiClient.post<Project>('/projects', data);
  return response.data;
}

/** 更新项目 */
export async function updateProject(
  projectId: string,
  data: UpdateProjectRequest
): Promise<Project> {
  const response = await apiClient.patch<Project>(`/projects/${projectId}`, data);
  return response.data;
}

/** 删除项目 */
export async function deleteProject(projectId: string): Promise<void> {
  await apiClient.delete(`/projects/${projectId}`);
}

/** 启动项目 */
export async function startProject(projectId: string): Promise<Project> {
  const response = await apiClient.post<Project>(`/projects/${projectId}/submit-task`, {
    title: '开始执行',
  });
  return response.data;
}

/** 暂停项目 */
export async function pauseProject(projectId: string): Promise<Project> {
  const response = await apiClient.patch<Project>(`/projects/${projectId}`, {
    status: 'paused',
  });
  return response.data;
}

/** 获取项目的 SSE 事件流 URL */
export function getProjectSSEUrl(projectId: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || '';
  return `${base}/api/projects/${projectId}/stream`;
}
