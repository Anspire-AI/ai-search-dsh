# staging 环境

## 访问
- 域名：见 `apps/*/helm/environments/.env.staging` 中 `INGRESS_HOST`
- 用途：Post-merge 验证（QA Agent 在此执行 e2e / 回归测试）

## 部署触发
PR 合并到 `develop` 后 CD 自动部署到本环境。
