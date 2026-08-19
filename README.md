# Deploy - 部署配置工作区

本目录是 `deploy` 分支的 worktree，由 Deploy Agent / CI 管理。

## 核心原则

**Deploy 分支只做「部署配置」，不做「构建」。**

```
CI 的职责：                    Deploy 的职责：
代码 checkout → 构建镜像       helm chart → k8s manifests
→ 打镜像 tag → 推镜像仓库      → 环境配置 → rollout
```

## 目录结构

```
Deploy/
├── apps/
│   └── ai-search/
│       ├── helm/
│       │   ├── Chart.yaml
│       │   ├── templates/
│       │   ├── values.yaml
│       │   └── environments/
│       │       ├── .env.staging
│       │       └── .env.production
│       └── deploy.sh
├── environments/
│   ├── staging/
│   └── production/
├── releases/                    # 发布快照
├── scripts/
│   ├── deploy.sh
│   ├── rollback.sh
│   └── healthcheck.sh
└── .deploy/                     # 私有工作目录（不入库）
```

## 镜像 Tag 策略

| 场景 | Tag | 说明 |
|------|-----|------|
| 默认 | `{GIT_SHA}` | develop 分支最新 commit SHA |
| 发布 | `{GIT_TAG}` | 如 v1.0.0 |
| 特殊 | 用户指定 | 手动覆盖 |

## 部署流程

1. 确认部署目标（环境、应用、镜像 tag）
2. 更新对应环境的 `.env` 文件中的 `IMAGE_TAG`
3. `git commit + push` → 触发 CD
4. 监控 CD 流水线
5. 执行健康检查
6. 记录发布

## 回滚流程

回滚本质是一个新的部署操作：

1. 确认要回滚的版本
2. `git revert` 上一个部署 commit
3. 调整 `.env` 中的镜像 tag 为旧版本
4. `git commit + push` → 触发 CD 回滚
5. 确认回滚成功
6. 记录回滚原因
