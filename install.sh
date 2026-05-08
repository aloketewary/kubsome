#!/bin/bash
# Kubsome — Interactive Installer
# Usage: ./install.sh

set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

clear

echo ""
echo -e "${GREEN}${BOLD}  🚀 Kubsome Installer${NC}"
echo -e "${DIM}  AI-native Kubernetes Operational Workspace${NC}"
echo ""
echo "  ─────────────────────────────────────────"
echo ""

# ─── Check Prerequisites ───

echo -e "${CYAN}  Checking prerequisites...${NC}"
echo ""

# Python
if command -v python3 &> /dev/null; then
    PY_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    echo -e "  ${GREEN}✓${NC} Python ${PY_VERSION}"
else
    echo -e "  ${RED}✗${NC} Python 3.9+ not found"
    echo -e "    Install from: ${CYAN}https://python.org${NC}"
    exit 1
fi

# kubectl
if command -v kubectl &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} kubectl found"
else
    echo -e "  ${YELLOW}⚠${NC} kubectl not found (needed for cluster access)"
fi

# Node.js (optional)
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version 2>&1)
    echo -e "  ${GREEN}✓${NC} Node.js ${NODE_VERSION} ${DIM}(for Web UI)${NC}"
    HAS_NODE=true
else
    echo -e "  ${DIM}○${NC} Node.js not found ${DIM}(optional, for Web UI dev)${NC}"
    HAS_NODE=false
fi

echo ""
echo "  ─────────────────────────────────────────"
echo ""

# ─── Choose Install Mode ───

echo -e "${CYAN}  What would you like to install?${NC}"
echo ""
echo -e "  ${BOLD}1)${NC} CLI only          ${DIM}— Interactive terminal (recommended)${NC}"
echo -e "  ${BOLD}2)${NC} CLI + TUI         ${DIM}— Terminal + full-screen dashboard${NC}"
echo -e "  ${BOLD}3)${NC} CLI + API         ${DIM}— Terminal + REST API server${NC}"
echo -e "  ${BOLD}4)${NC} Everything        ${DIM}— CLI + TUI + API + Web UI${NC}"
echo ""

read -p "  Choose [1-4] (default: 1): " INSTALL_MODE
INSTALL_MODE=${INSTALL_MODE:-1}

echo ""

# ─── Choose Theme ───

echo -e "${CYAN}  Choose a theme:${NC}"
echo ""
echo -e "  ${BOLD}1)${NC} dark     ${DIM}— Default dark theme${NC}"
echo -e "  ${BOLD}2)${NC} light    ${DIM}— Light background friendly${NC}"
echo -e "  ${BOLD}3)${NC} minimal  ${DIM}— Clean, less color${NC}"
echo -e "  ${BOLD}4)${NC} hacker   ${DIM}— Green on black${NC}"
echo ""

read -p "  Choose [1-4] (default: 1): " THEME_CHOICE
THEME_CHOICE=${THEME_CHOICE:-1}

case $THEME_CHOICE in
    2) THEME="light" ;;
    3) THEME="minimal" ;;
    4) THEME="hacker" ;;
    *) THEME="dark" ;;
esac

echo ""

# ─── Enable Notifications? ───

read -p "  Enable desktop notifications for critical alerts? [Y/n]: " NOTIFY
NOTIFY=${NOTIFY:-Y}

if [[ "$NOTIFY" =~ ^[Yy]$ ]]; then
    NOTIFICATIONS="true"
else
    NOTIFICATIONS="false"
fi

echo ""
echo "  ─────────────────────────────────────────"
echo ""
echo -e "${CYAN}  Installing...${NC}"
echo ""

# ─── Create Virtual Environment ───

if [ ! -d "venv" ]; then
    echo -e "  ${DIM}Creating virtual environment...${NC}"
    python3 -m venv venv
fi

source venv/bin/activate

# ─── Install Dependencies ───

case $INSTALL_MODE in
    1)
        echo -e "  ${DIM}Installing CLI dependencies...${NC}"
        pip install -e . --quiet
        ;;
    2)
        echo -e "  ${DIM}Installing CLI + TUI dependencies...${NC}"
        pip install -e ".[tui]" --quiet
        ;;
    3)
        echo -e "  ${DIM}Installing CLI + API dependencies...${NC}"
        pip install -e ".[api]" --quiet
        ;;
    4)
        echo -e "  ${DIM}Installing all dependencies...${NC}"
        pip install -e ".[all]" --quiet
        if [ "$HAS_NODE" = true ]; then
            echo -e "  ${DIM}Installing Web UI dependencies...${NC}"
            cd ui && npm install --silent 2>/dev/null && cd ..
        fi
        ;;
esac

# ─── Create Config ───

mkdir -p ~/.kubsome/plugins ~/.kubsome/workflows ~/.kubsome/snapshots

CONFIG_FILE=~/.kubsome/config.yaml

if [ ! -f "$CONFIG_FILE" ]; then
    cat > "$CONFIG_FILE" << EOF
# Kubsome Configuration
refresh_interval: 2
notifications: ${NOTIFICATIONS}
theme: ${THEME}

restart_warning_threshold: 2
restart_critical_threshold: 5
log_tail_lines: 100

llm:
  provider: local
  model: llama3
  url: http://localhost:11434

aliases:
  p: pods
  pw: pods watch
  o: overview
  e: events
  ew: events watch
  l: logs
  lc: logcat
  i: inspect
  d: diagnose
  t: trace
  tp: top pods
  tn: top nodes
  h: help
  f: find
  s: switch
  sec: security
  opt: optimize
EOF
    echo -e "  ${GREEN}✓${NC} Config created: ~/.kubsome/config.yaml"
else
    echo -e "  ${DIM}○${NC} Config exists: ~/.kubsome/config.yaml"
fi

echo ""
echo "  ─────────────────────────────────────────"
echo ""
echo -e "  ${GREEN}${BOLD}✓ Kubsome installed successfully!${NC}"
echo ""
echo -e "  ${BOLD}Getting started:${NC}"
echo ""
echo -e "    ${CYAN}source venv/bin/activate${NC}"
echo ""

case $INSTALL_MODE in
    1)
        echo -e "    ${CYAN}kubsome${NC}              Interactive CLI"
        echo -e "    ${CYAN}kubsome --exec check${NC} Single command"
        ;;
    2)
        echo -e "    ${CYAN}kubsome${NC}              Interactive CLI"
        echo -e "    ${CYAN}kubsome tui${NC}          Full-screen dashboard"
        ;;
    3)
        echo -e "    ${CYAN}kubsome${NC}              Interactive CLI"
        echo -e "    ${CYAN}kubsome serve${NC}        API server (:8000)"
        ;;
    4)
        echo -e "    ${CYAN}kubsome${NC}              Interactive CLI"
        echo -e "    ${CYAN}kubsome serve${NC}        API + Web UI (:8000)"
        echo -e "    ${CYAN}kubsome tui${NC}          Full-screen dashboard"
        echo -e "    ${CYAN}kubsome --exec check${NC} Single command (CI/CD)"
        ;;
esac

echo ""
echo -e "  ${DIM}Type 'help' inside Kubsome for 85+ commands${NC}"
echo -e "  ${DIM}Theme: ${THEME} | Notifications: ${NOTIFICATIONS}${NC}"
echo ""
