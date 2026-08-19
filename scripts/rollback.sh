#!/usr/bin/env bash
# 回滚脚本：本质是一个使用旧镜像 tag 的新部署
# 用法: ./rollback.sh <app> <environment> <old_image_tag>
set -euo pipefail

APP="${1:?用法: rollback.sh <app> <environment> <old_image_tag>}"
ENV="${2:?缺少 environment}"
OLD_TAG="${3:?缺少 old_image_tag}"

echo "==> 回滚 $APP($ENV) 到镜像 tag: $OLD_TAG"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/deploy.sh" "$APP" "$ENV" "$OLD_TAG"

echo "==> 回滚完成，请确认服务状态并记录回滚原因到 releases/"
