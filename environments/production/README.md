# production 环境

## 访问
- 域名：见 `apps/*/helm/environments/.env.production` 中 `INGRESS_HOST`
- 用途：生产服务

## 部署触发
`release/vx.y.z` 合并到 `main` 并打 Git Tag 后，手动确认触发 CD 部署。

## 变更窗口
默认仅在确认变更窗口内部署；紧急修复（hotfix）例外。
