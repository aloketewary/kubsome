#!/bin/bash
# Kubsome — Build & Publish to PyPI
# Usage: ./publish.sh [--test]

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

echo ""
echo -e "${GREEN}◆ Kubsome — Package Builder${NC}"
echo "───────────────────────────────"
echo ""

# Clean previous builds
rm -rf dist/ build/ *.egg-info
echo -e "${DIM}  Cleaned previous builds${NC}"

# Bundle UI dist into api/
if [ -d "ui/dist/ui/browser" ]; then
    rm -rf api/ui_dist
    cp -r ui/dist/ui/browser api/ui_dist
    echo -e "${DIM}  Bundled UI dist into api/ui_dist${NC}"
else
    echo -e "${CYAN}  Building Angular UI first...${NC}"
    cd ui && npx ng build --configuration production && cd ..
    rm -rf api/ui_dist
    cp -r ui/dist/ui/browser api/ui_dist
    echo -e "${DIM}  Bundled UI dist into api/ui_dist${NC}"
fi

# Build
echo -e "${DIM}  Building sdist + wheel...${NC}"
python3 -m build

echo ""
echo -e "${GREEN}✓ Build complete${NC}"
ls -lh dist/
echo ""

# Upload
if [ "$1" == "--test" ]; then
    echo -e "${CYAN}  Uploading to TestPyPI...${NC}"
    python3 -m twine upload --repository testpypi dist/*
    echo ""
    echo -e "${GREEN}✓ Published to TestPyPI${NC}"
    echo -e "  Install: pip install -i https://test.pypi.org/simple/ kubsome"
else
    echo -e "${CYAN}  Uploading to PyPI...${NC}"
    python3 -m twine upload dist/*
    echo ""
    echo -e "${GREEN}✓ Published to PyPI${NC}"
    echo -e "  Install: pip install kubsome"
fi

echo ""
