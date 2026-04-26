# Multi-Agent Platform

数据库驱动的通用多智能体协作平台。Agent 之间不靠语言交流，而是通过数据库的状态映射来传递任务和上下文。

## 架构特点

- **数据库驱动通信**：黑板模式（Blackboard Pattern），Agent 读写共享数据库
- **实时监控**：SSE + WebSocket 双通道，可查看每个 Agent 的思考过程和产出
- **人工介入**：审核门机制，可在任意节点暂停、修改、重试
- **国产模型优先**：Kimi/DeepSeek/豆包三模型互为降级链
- **结构化文档通信**：Agent 间传递 JSON 而非自由文本

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python + FastAPI + SQLAlchemy + CrewAI + LiteLLM |
| 前端 | React + TypeScript + Vite + React Flow + Zustand |
| 数据库 | PostgreSQL |
| 实时通信 | SSE + WebSocket |

## 快速开始

### 1. 启动数据库

```bash
docker compose up -d
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入你的 LLM API Key
```

### 3. 启动后端

```bash
cd backend
pip install -e ".[dev]" --break-system-packages
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

### 5. 访问

- 前端: http://localhost:5173
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/api/health

## Agent 角色

| 角色 | 职责 |
|------|------|
| manager | 项目经理，任务拆分与分配 |
| researcher | 研究员，信息检索与分析 |
| writer | 写作者，文档撰写 |
| reviewer | 审核员，质量控制 |
| analyst | 分析师，数据分析 |
| teacher | 费曼讲师，知识讲解 |

## 项目结构

```
multi-agent-platform/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口
│   │   ├── config/              # 配置（LLM、Agent 角色）
│   │   ├── api/                 # REST API + SSE + WebSocket
│   │   ├── core/                # 数据库、ORM、事件总线
│   │   ├── engine/              # 任务引擎、状态机、编排器
│   │   ├── agents/              # Agent 实现
│   │   ├── memory/              # 上下文构建、摘要压缩
│   │   └── llm/                 # LLM 路由与降级
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── api/                 # API 客户端
│   │   ├── hooks/               # SSE/WebSocket Hooks
│   │   ├── components/          # 监控 UI 组件
│   │   ├── pages/               # 页面
│   │   ├── store/               # Zustand 状态管理
│   │   └── types/               # TypeScript 类型
│   └── package.json
└── docker-compose.yml
```

## 演进路径

- **MVP** (当前): CrewAI + 数据库驱动通信
- **生产**: 迁移到 LangGraph（图状态机 + interrupt()）
- **长期**: 向量记忆、MCP 工具生态、多模态、分布式执行
