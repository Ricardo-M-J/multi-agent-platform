import apiClient from './client';

export interface AgentConfig {
  name: string;
  role: string;
  goal: string;
  backstory: string;
  system_prompt: string;
  llm: string;
  llm_params: { temperature?: number; max_tokens?: number };
  skills: string[];
  tools: string[];
}

export interface SkillConfig {
  name: string;
  type: string;
  description: string;
  prompt_modifier: string;
}

export async function getAgents(): Promise<AgentConfig[]> {
  const response = await apiClient.get<AgentConfig[]>('/agents');
  return Array.isArray(response.data) ? response.data : [];
}

export async function getAgent(name: string): Promise<AgentConfig> {
  const response = await apiClient.get<AgentConfig>(`/agents/${name}`);
  return response.data;
}

export async function updateAgent(name: string, config: Partial<AgentConfig>): Promise<AgentConfig> {
  const response = await apiClient.put<AgentConfig>(`/agents/${name}`, config);
  return response.data;
}

export async function getSkills(): Promise<SkillConfig[]> {
  const response = await apiClient.get<SkillConfig[]>('/agents/skills/list');
  return Array.isArray(response.data) ? response.data : [];
}

export async function updateSkill(name: string, config: Partial<SkillConfig>): Promise<SkillConfig> {
  const response = await apiClient.put<SkillConfig>(`/agents/skills/${name}`, config);
  return response.data;
}

export async function createSkill(name: string, config: Partial<SkillConfig>): Promise<SkillConfig> {
  const response = await apiClient.post<SkillConfig>(`/agents/skills/${name}`, config);
  return response.data;
}
