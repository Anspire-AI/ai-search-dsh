# anspire-ai-search

AI 搜索服务。

## 工作区结构（Agent Workspace v2）

本仓库基于 Git Worktree 组织多 Agent 协作，根目录即中央仓库（`main` 分支）：

```
anspire-ai-search/               # 中央仓库（main 分支）
├── .git/
├── BA/                          # [worktree] demand 分支 - 需求管理
├── code/                        # [worktree] develop 分支 - CI 只读
├── Deploy/                      # [worktree] deploy 分支 - 部署配置
├── feature-REQ-xxx/             # [worktree] feature/REQ-xxx 分支 - 开发（按需创建）
├── hotfix-xxx/                  # [worktree] hotfix/xxx 分支 - 紧急修复（按需创建）
├── README.md
├── CHANGELOG.md
└── .gitignore
```

## 分支与工作区

| 分支 | Worktree | 用途 | 写入者 |
|------|----------|------|--------|
| `main` | 根目录 | 生产发布标记 | 仅从 release 合并 |
| `develop` | `code/` | 主开发分支，CI 构建 | 合并，不直接写 |
| `demand` | `BA/` | 需求管理 | BA Agent |
| `deploy` | `Deploy/` | 部署配置 | Deploy Agent / CI |
| `feature/REQ-xxx` | `feature-REQ-xxx/` | 需求开发 | Dev Agent |
| `release/vx.y.z` | — | 预发布 | 发布管理员 |
| `hotfix/xxx` | `hotfix-xxx/` | 紧急修复（基于 main） | Dev Agent |

## 命名规范

- 需求编号：`REQ-{三位数字}`，如 `REQ-001`
- Commit Message：`[{区域}] {描述} (关联: {需求ID})`
- 镜像 Tag：默认 `{GIT_SHA}`，发布用 `{GIT_TAG}`

## 常用命令

```bash
# 创建需求开发 worktree（BA Agent 执行）
git worktree add feature-REQ-001 feature/REQ-001

# 同步 develop 到本地
git fetch origin && git rebase origin/develop

# 清理已合并的 worktree
git worktree remove feature-REQ-001
git branch -d feature/REQ-001
git push origin --delete feature/REQ-001
```

详细规范参见各 worktree 内的 README。
