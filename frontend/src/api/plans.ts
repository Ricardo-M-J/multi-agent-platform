import apiClient from './client';

export interface PlanTask {
  id: string;
  title: string;
  description: string | null;
  assigned_agent: string | null;
  priority: number;
  requires_human_review: boolean;
  parent_task_id: string | null;
}

export async function getPlan(projectId: string): Promise<PlanTask[]> {
  const response = await apiClient.get<PlanTask[]>(`/projects/${projectId}/plan`);
  return Array.isArray(response.data) ? response.data : [];
}

export async function updatePlanTask(projectId: string, taskId: string, data: Partial<PlanTask>): Promise<{ message: string }> {
  const response = await apiClient.put(`/projects/${projectId}/plan/tasks/${taskId}`, data);
  return response.data;
}

export async function deletePlanTask(projectId: string, taskId: string): Promise<{ message: string }> {
  const response = await apiClient.delete(`/projects/${projectId}/plan/tasks/${taskId}`);
  return response.data;
}

export async function addPlanTask(projectId: string, data: Partial<PlanTask>): Promise<{ message: string; task_id: string }> {
  const response = await apiClient.post(`/projects/${projectId}/plan/tasks`, data);
  return response.data;
}

export async function confirmPlan(projectId: string): Promise<{ message: string; count: number }> {
  const response = await apiClient.post(`/projects/${projectId}/plan/confirm`);
  return response.data;
}
