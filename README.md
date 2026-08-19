# BA - 需求管理工作区

本目录是 `demand` 分支的 worktree，由 BA Agent 负责需求管理、迭代管理、调度管理和 worktree 生命周期管理。

## 目录结构

```
BA/
├── README.md
├── demands/                      # 需求文档
│   ├── REQ-001-xxx/
│   │   ├── demand.md             # 需求描述
│   │   ├── acceptance.md         # 验收标准
│   │   ├── design-summary.md     # 设计概要
│   │   ├── status.md             # 当前状态
│   │   └── test-cases/           # 测试用例（QA 创建）
│   └── _template/                # 需求模板
├── backlog/
│   ├── inbox/                    # 未梳理的原始想法
│   └── refined/                  # 已梳理待排期
├── sprint/
│   ├── current.md                # 当前迭代计划
│   └── retrospective.md          # 复盘
├── decisions/                    # 架构决策记录 (ADR)
├── dispatch/
│   ├── rules.md                  # 调度规则
│   ├── registry.md               # Agent 注册表
│   ├── verification-queue.md     # 待验证队列
│   └── cleanup-log.md            # worktree 回收日志
└── .ba/                          # BA 私有工作目录（不入库）
```

## 需求状态流转

```
草稿 → 已评审 → 已就绪 → 进行中 → 待验证 → 已验证 → 已完成
                            ↓                ↓
                         已取消         已退回 → 进行中
```

## 分配需求流程

1. 确认需求状态为「已就绪」
2. 从 `dispatch/rules.md` 查找可用 Dev Agent
3. 创建 feature worktree：`git worktree add feature-REQ-xxx feature/REQ-xxx`
4. 在 `.feature/manifest.json` 中记录分配信息
5. 更新需求状态为「进行中」
6. 创建 QA 子 agent 生成测试用例 → 创建 Dev 子 agent 开发

## 工作区规则

- 所有变更通过 Git 持久化（commit 到 `demand` 分支）
- 需求文档按 `REQ-{三位数字}` 编号，目录名 `REQ-001-{slug}`
- Dev Agent 在 `feature-REQ-xxx/` 开发，PR 合并目标为 `develop`
- 每次启动时执行 worktree 巡检（见 `dispatch/cleanup-log.md`）
