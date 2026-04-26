import apiClient from './client';
import type { Artifact } from '../types';

/** 获取项目的所有产出物 */
export async function getArtifacts(projectId: string): Promise<Artifact[]> {
  const response = await apiClient.get<Artifact[]>(
    `/projects/${projectId}/artifacts`
  );
  return Array.isArray(response.data) ? response.data : [];
}
