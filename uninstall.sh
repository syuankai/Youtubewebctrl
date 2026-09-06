#!/usr/bin/env bash
# ==============================================================================
# YouTube Linux 音樂播放服務 - 解除安裝腳本
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

SERVICE_NAME="yt-audio-player"

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[錯誤]${NC} 請使用 root 或 sudo 權限執行此腳本: ${YELLOW}sudo ./uninstall.sh${NC}"
  exit 1
fi

echo -e "${CYAN}${BOLD}正在解除安裝 ${SERVICE_NAME} 背景服務...${NC}"

if systemctl is-active --quiet "${SERVICE_NAME}.service"; then
  echo "正在停止服務..."
  systemctl stop "${SERVICE_NAME}.service" || true
fi

if systemctl is-enabled --quiet "${SERVICE_NAME}.service" 2>/dev/null; then
  echo "正在取消開機自啟動..."
  systemctl disable "${SERVICE_NAME}.service" || true
fi

if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
  echo "移除 systemd 服務設定檔..."
  rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
  systemctl daemon-reload
fi

echo -e "${GREEN}[✔] 已成功移除 ${SERVICE_NAME} systemd 服務註冊。${NC}"
