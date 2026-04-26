import apiClient from './client';
import type {
  Task,
  TaskReviewRequest,
  TaskRetryRequest,
  Artifact,
} from '../types';

/** 获取任务详情 */
export async function getTask(projectId: string, taskId: string): Promise<Task> {
  const response = await apiClient.get<Task>(
    `/projects/${projectId}/tasks/${taskId}`
  );
  return response.data;
}

/** 获取项目所有任务 */
export async function getTasks(projectId: string): Promise<Task[]> {
  const response = await apiClient.get<Task[]>(`/projects/${projectId}/tasks`);
  return response.data;
}

/** 审核任务（通过/拒绝/修改/重试） */
export async function reviewTask(
  projectId: string,
  taskId: string,
  data: TaskReviewRequest
): Promise<Task> {
  const response = await apiClient.post<Task>(
    `/projects/${projectId}/tasks/${taskId}/review`,
    data
  );
  return response.data;
}

/** 重试任务 */
export async function retryTask(
  projectId: string,
  taskId: string,
  data?: TaskRetryRequest
): Promise<Task> {
  const response = await apiClient.post<Task>(
    `/projects/${projectId}/tasks/${taskId}/retry`,
    data
  );
  return response.data;
}

/** 获取任务的产出物 */
export async function getTaskArtifacts(
  projectId: string,
  taskId: string
): Promise<Artifact[]> {
  const response = await apiClient.get<Artifact[]>(
    `/projects/${projectId}/tasks/${taskId}/artifacts`
  );
  return response.data;
}

/** 获取产出物内容 */
export async function getArtifact(
  projectId: string,
  artifactId: string
): Promise<Artifact> {
  const response = await apiClient.get<Artifact>(
    `/projects/${projectId}/artifacts/${artifactId}`
  );
  return response.data;
}

/** 更新产出物内容（人工修改） */
export async function updateArtifact(
  projectId: string,
  artifactId: string,
  content: string
): Promise<Artifact> {
  const response = await apiClient.patch<Artifact>(
    `/projects/${projectId}/artifacts/${artifactId}`,
    { content }
  );
  return response.data;
}
