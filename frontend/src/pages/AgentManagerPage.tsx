import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Save, RotateCcw, Cpu, Sparkles } from 'lucide-react';
import { getAgents, getSkills, updateAgent } from '../api/agents';
import type { AgentConfig, SkillConfig } from '../api/agents';

/**
 * Agent 管理页面
 * 左侧 Agent 列表 + 右侧编辑面板
 */
export function AgentManagerPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [skills, setSkills] = useState<SkillConfig[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // 编辑表单状态
  const [editRole, setEditRole] = useState('');
  const [editGoal, setEditGoal] = useState('');
  const [editLlm, setEditLlm] = useState('');
  const [editTemperature, setEditTemperature] = useState(0.7);
  const [editMaxTokens, setEditMaxTokens] = useState(2048);
  const [editSystemPrompt, setEditSystemPrompt] = useState('');
  const [editSkills, setEditSkills] = useState<string[]>([]);

  // 加载 Agent 和 Skills 列表
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [agentList, skillList] = await Promise.all([getAgents(), getSkills()]);
      setAgents(agentList);
      setSkills(skillList);
    } catch (err) {
      console.error('加载 Agent 数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 选中 Agent 时填充编辑表单
  const handleSelectAgent = useCallback((agent: AgentConfig) => {
    setSelectedAgent(agent);
    setEditRole(agent.role);
    setEditGoal(agent.goal);
    setEditLlm(agent.llm);
    setEditTemperature(agent.llm_params?.temperature ?? 0.7);
    setEditMaxTokens(agent.llm_params?.max_tokens ?? 2048);
    setEditSystemPrompt(agent.system_prompt);
    setEditSkills(agent.skills ?? []);
    setSaveMsg(null);
  }, []);

  // 重置表单
  const handleReset = useCallback(() => {
    if (selectedAgent) {
      handleSelectAgent(selectedAgent);
    }
  }, [selectedAgent, handleSelectAgent]);

  // 切换 Skill 勾选
  const handleToggleSkill = useCallback((skillName: string) => {
    setEditSkills((prev) =>
      prev.includes(skillName)
        ? prev.filter((s) => s !== skillName)
        : [...prev, skillName]
    );
  }, []);

  // 保存配置
  const handleSave = useCallback(async () => {
    if (!selectedAgent) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await updateAgent(selectedAgent.name, {
        role: editRole,
        goal: editGoal,
        llm: editLlm,
        llm_params: {
          temperature: editTemperature,
          max_tokens: editMaxTokens,
        },
        system_prompt: editSystemPrompt,
        skills: editSkills,
      });
      setSaveMsg('✅ 配置已保存，立即生效');
      // 刷新列表
      const agentList = await getAgents();
      setAgents(agentList);
      // 更新选中的 agent
      const updated = agentList.find((a) => a.name === selectedAgent.name);
      if (updated) {
        setSelectedAgent(updated);
      }
    } catch (err) {
      console.error('保存失败:', err);
    } finally {
      setSaving(false);
    }
  }, [selectedAgent, editRole, editGoal, editLlm, editTemperature, editMaxTokens, editSystemPrompt, editSkills]);

  if (loading) {
    return (
      <div className="agent-manager">
        <div className="loading-state">加载 Agent 数据中...</div>
      </div>
    );
  }

  return (
    <div className="agent-manager">
      {/* 左侧 Agent 列表 */}
      <div className="agent-list">
        <h2 className="page-title">🤖 Agent 管理</h2>
        <button className="btn btn-ghost" onClick={fetchData} style={{ marginBottom: 12 }}>
          <RefreshCw size={14} />
          <span>刷新</span>
        </button>
        {agents.length === 0 ? (
          <div className="empty-mini">暂无 Agent</div>
        ) : (
          agents.map((agent) => (
            <div
              key={agent.name}
              role="button"
              tabIndex={0}
              className={`agent-card ${selectedAgent?.name === agent.name ? 'active' : ''}`}
              onClick={() => handleSelectAgent(agent)}
              onKeyDown={(e) => e.key === 'Enter' && handleSelectAgent(agent)}
            >
              <div className="agent-card-header">
                <div className="agent-avatar">
                  <Cpu size={16} />
                </div>
                <div className="agent-info">
                  <div className="agent-name">{agent.name}</div>
                  <div className="agent-role">{agent.role}</div>
                </div>
              </div>
              <div className="agent-card-body">
                <div className="agent-detail">
                  <span className="detail-label">Skills</span>
                  <span className="detail-value">{agent.skills?.length ?? 0} 个</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 右侧编辑面板 */}
      <div className="agent-editor">
        {!selectedAgent ? (
          <div className="empty-state">
            <Cpu size={32} />
            <p>请从左侧选择一个 Agent 进行编辑</p>
          </div>
        ) : (
          <>
            <div className="agent-editor-header">
              <h3 className="page-title">{selectedAgent.name}</h3>
            </div>

            {saveMsg && (
              <div className="save-indicator">{saveMsg}</div>
            )}

            <div className="agent-editor-form">
              {/* Agent 名称（只读） */}
              <div className="form-group">
                <label className="form-label">Agent 名称</label>
                <input
                  className="form-input"
                  value={selectedAgent.name}
                  readOnly
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>

              {/* 角色 */}
              <div className="form-group">
                <label className="form-label">角色</label>
                <input
                  className="form-input"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  placeholder="请输入角色描述"
                />
              </div>

              {/* 目标 */}
              <div className="form-group">
                <label className="form-label">目标</label>
                <input
                  className="form-input"
                  value={editGoal}
                  onChange={(e) => setEditGoal(e.target.value)}
                  placeholder="请输入 Agent 目标"
                />
              </div>

              {/* 模型选择 */}
              <div className="form-group">
                <label className="form-label">模型 (LLM)</label>
                <input
                  className="form-input"
                  value={editLlm}
                  onChange={(e) => setEditLlm(e.target.value)}
                  placeholder="例如: gpt-4, claude-3"
                />
              </div>

              {/* Temperature */}
              <div className="form-group">
                <label className="form-label">
                  Temperature: <span style={{ color: 'var(--accent-blue)' }}>{editTemperature.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={editTemperature}
                  onChange={(e) => setEditTemperature(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
                />
              </div>

              {/* Max Tokens */}
              <div className="form-group">
                <label className="form-label">Max Tokens</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  max={128000}
                  value={editMaxTokens}
                  onChange={(e) => setEditMaxTokens(parseInt(e.target.value) || 2048)}
                />
              </div>

              {/* System Prompt */}
              <div className="form-group">
                <label className="form-label">System Prompt</label>
                <textarea
                  className="form-input form-textarea"
                  rows={12}
                  value={editSystemPrompt}
                  onChange={(e) => setEditSystemPrompt(e.target.value)}
                  placeholder="请输入 System Prompt..."
                />
              </div>

              {/* Skills 多选 */}
              <div className="form-group">
                <label className="form-label">
                  <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                  Skills
                </label>
                <div className="skill-checkboxes">
                  {skills.length === 0 ? (
                    <div className="empty-mini">暂无可用 Skills</div>
                  ) : (
                    skills.map((skill) => (
                      <label key={skill.name} className="skill-checkbox-item">
                        <input
                          type="checkbox"
                          checked={editSkills.includes(skill.name)}
                          onChange={() => handleToggleSkill(skill.name)}
                        />
                        <span className="skill-checkbox-name">{skill.name}</span>
                        <span className="skill-checkbox-desc">{skill.description}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="agent-editor-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save size={14} />
                  <span>{saving ? '保存中...' : '保存'}</span>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleReset}
                >
                  <RotateCcw size={14} />
                  <span>重置</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AgentManagerPage;
