#!/usr/bin/env bash
# 健康检查：等待 Pod Ready 并探测健康端点
# 用法: ./healthcheck.sh <app>
set -euo pipefail

APP="${1:?用法: healthcheck.sh <app>}"
TIMEOUT="${TIMEOUT:-120}"

echo "==> 检查 $APP Pod 状态"
kubectl rollout status deployment/"$APP" --timeout="${TIMEOUT}s"

echo "==> 探测健康端点"
POD=$(kubectl get pods -n "$APP" -l app.kubernetes.io/name="$APP" -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n "$APP" "$POD" -- wget -qO- http://localhost:8080/healthz || {
  echo "健康检查失败"; exit 1
}
echo "==> 健康检查通过"
