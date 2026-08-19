#!/usr/bin/env bash
# 通用部署脚本：加载环境变量 → helm upgrade
# 用法: ./deploy.sh <app> <environment> [image_tag]
set -euo pipefail

APP="${1:?用法: deploy.sh <app> <environment> [image_tag]}"
ENV="${2:?缺少 environment: staging|production}"
TAG="${3:-}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT/apps/$APP/helm/environments/.env.$ENV"

[ -f "$ENV_FILE" ] || { echo "未找到环境配置: $ENV_FILE"; exit 1; }

# 加载环境变量（支持 KEY=VALUE 覆盖）
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

[ -n "$TAG" ] && IMAGE_TAG="$TAG"

echo "==> 部署 $APP 到 $ENV，镜像 tag: $IMAGE_TAG"
helm upgrade --install "$APP" "$ROOT/apps/$APP/helm" \
  -n "$APP" --create-namespace \
  --set image.tag="$IMAGE_TAG" \
  --set replicaCount="$REPLICA_COUNT" \
  --wait --timeout 5m

echo "==> 部署完成，执行健康检查"
"$ROOT/scripts/healthcheck.sh" "$APP"
