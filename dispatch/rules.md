# 调度规则

## Dev Agent 调度

1. **能力匹配**：按 `registry.md` 中的技能标签选择 Dev Agent
2. **负载均衡**：同时只分配一个 feature worktree 给每个 Dev Agent
3. **串行分配**：同一需求编号只分配给一个 Dev Agent，避免冲突

## QA Agent 调度

1. **Pre-merge 验证**：Dev Agent 提交「待验证」后触发，在 feature worktree 中验证
2. **Post-merge 验证**：PR 合并到 develop 并部署 staging 后触发
3. **独立性**：验证 Agent 与开发 Agent 必须不同，保证验证客观

## 状态触发规则

| 当前状态 | 触发动作 | 下一状态 |
|----------|----------|----------|
| 已就绪 | 分配 Dev Agent + 创建 worktree | 进行中 |
| 进行中 | Dev 提交自验证报告 | 待验证 |
| 待验证 | QA Pre-merge 验证 | 已验证 / 已退回 |
| 已退回 | Dev 修改后重新提交 | 待验证 |
| 已验证 | 创建 PR → 合并 → staging 部署 | 已完成（Post-merge 通过后） |

## worktree 巡检（每次 BA Agent 启动时执行）

1. 扫描所有 `feature-*` 和 `hotfix-*` worktree
2. 检查分支状态（是否已合并到 develop）
3. 已合并但未清理的 → 执行清理
4. 记录到 `cleanup-log.md`
