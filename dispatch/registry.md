# Agent 注册表

## 当前注册的 Agent

| Agent | 角色 | 技能标签 | 工作区 | 状态 |
|-------|------|----------|--------|------|
| ba-agent-01 | BA | 需求管理、worktree 管理、调度 | BA/ | 活跃 |
| qa-agent-01 | QA | 测试设计、Pre-merge 验证 | feature-REQ-xxx/（按需） | 空闲 |
| dev-agent-01 | Dev | 编码、测试、自验证 | feature-REQ-xxx/（按需） | 空闲 |
| deploy-agent-01 | Deploy | helm、k8s、CD | Deploy/ | 空闲 |

## 注册格式

```
| {agent-id} | {BA/QA/Dev/Deploy} | {技能标签} | {默认工作区} | {活跃/空闲/离线} |
```

新 Agent 注册时追加一行；状态变更时更新对应行。
