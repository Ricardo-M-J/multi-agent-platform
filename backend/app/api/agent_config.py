"""Agent configuration CRUD API.

Allows frontend to read/modify agent prompts, skills, and LLM parameters
without restarting the server.
"""

import logging

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_reloader():
    from app.config.hot_reload import ConfigHotReloader
    from app.agents.base_agent import _AGENTS_CONFIG_PATH
    return ConfigHotReloader(str(_AGENTS_CONFIG_PATH))


@router.get("")
async def list_agents():
    """Get all agent configurations."""
    reloader = _get_reloader()
    agents = reloader.get_all_agents()
    result = []
    for name, cfg in agents.items():
        result.append({
            "name": name,
            "role": cfg.get("role", ""),
            "goal": cfg.get("goal", ""),
            "backstory": cfg.get("backstory", ""),
            "system_prompt": cfg.get("system_prompt", ""),
            "llm": cfg.get("llm", ""),
            "llm_params": cfg.get("llm_params", {}),
            "skills": cfg.get("skills", []),
            "tools": cfg.get("tools", []),
        })
    return result


@router.get("/{agent_name}")
async def get_agent(agent_name: str):
    """Get a single agent's configuration."""
    reloader = _get_reloader()
    cfg = reloader.get_agent_config(agent_name)
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_name}' not found")
    return {
        "name": agent_name,
        "role": cfg.get("role", ""),
        "goal": cfg.get("goal", ""),
        "backstory": cfg.get("backstory", ""),
        "system_prompt": cfg.get("system_prompt", ""),
        "llm": cfg.get("llm", ""),
        "llm_params": cfg.get("llm_params", {}),
        "skills": cfg.get("skills", []),
        "tools": cfg.get("tools", []),
    }


@router.put("/{agent_name}")
async def update_agent(agent_name: str, body: dict):
    """Update an agent's configuration (prompt, skills, llm_params)."""
    reloader = _get_reloader()
    config = reloader.get_config()

    if agent_name not in config.get("agents", {}):
        raise HTTPException(status_code=404, detail=f"Agent '{agent_name}' not found")

    agent_cfg = config["agents"][agent_name]

    # Update allowed fields
    for field in ["role", "goal", "backstory", "system_prompt", "llm", "llm_params", "skills", "tools"]:
        if field in body:
            agent_cfg[field] = body[field]

    reloader.update_config(config)
    logger.info(f"Agent '{agent_name}' configuration updated via API")

    return {
        "name": agent_name,
        "role": agent_cfg.get("role", ""),
        "goal": agent_cfg.get("goal", ""),
        "system_prompt": agent_cfg.get("system_prompt", ""),
        "llm_params": agent_cfg.get("llm_params", {}),
        "skills": agent_cfg.get("skills", []),
    }


@router.get("/skills/list")
async def list_skills():
    """Get all available skills."""
    reloader = _get_reloader()
    skills = reloader.get_all_skills()
    result = []
    for name, cfg in skills.items():
        result.append({
            "name": name,
            "type": cfg.get("type", ""),
            "description": cfg.get("description", ""),
            "prompt_modifier": cfg.get("prompt_modifier", ""),
        })
    return result


@router.put("/skills/{skill_name}")
async def update_skill(skill_name: str, body: dict):
    """Update a skill's configuration."""
    reloader = _get_reloader()
    config = reloader.get_config()

    if "skills" not in config:
        config["skills"] = {}

    if skill_name not in config["skills"]:
        config["skills"][skill_name] = {}

    skill_cfg = config["skills"][skill_name]
    for field in ["type", "description", "prompt_modifier", "parameters"]:
        if field in body:
            skill_cfg[field] = body[field]

    reloader.update_config(config)
    logger.info(f"Skill '{skill_name}' configuration updated via API")

    return {"name": skill_name, **skill_cfg}


@router.post("/skills/{skill_name}")
async def create_skill(skill_name: str, body: dict):
    """Create a new skill."""
    reloader = _get_reloader()
    config = reloader.get_config()

    if "skills" not in config:
        config["skills"] = {}

    if skill_name in config["skills"]:
        raise HTTPException(status_code=409, detail=f"Skill '{skill_name}' already exists")

    config["skills"][skill_name] = {
        "type": body.get("type", "behavior"),
        "description": body.get("description", ""),
        "prompt_modifier": body.get("prompt_modifier", ""),
    }

    reloader.update_config(config)
    logger.info(f"Skill '{skill_name}' created via API")

    return {"name": skill_name, **config["skills"][skill_name]}
