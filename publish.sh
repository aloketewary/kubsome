#!/bin/bash
# Kubsome — Build & Publish to PyPI
# Usage: ./publish.sh [--test] [--no-publish]

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
DIM='\033[2m'
NC='\033[0m'

echo ""
echo -e "${GREEN}◆ Kubsome — Build & Publish${NC}"
echo "───────────────────────────────"
echo ""

# ── 1. Build Angular UI ───────────────────────────────────────────────────────
echo -e "${CYAN}  Building Angular UI...${NC}"
cd ui
npm install --legacy-peer-deps
npx ng build --configuration production
cd ..
echo -e "${DIM}  Angular build complete${NC}"

# ── 2. Copy dist → api/ui_dist ────────────────────────────────────────────────
echo -e "${CYAN}  Copying UI dist to api/ui_dist...${NC}"
rm -rf api/ui_dist
cp -r ui/dist/ui/browser api/ui_dist
echo -e "${DIM}  Copied $(ls api/ui_dist | wc -l | tr -d ' ') files to api/ui_dist${NC}"

# ── 3. Bump version (patch) ───────────────────────────────────────────────────
CURRENT=$(grep '^version' pyproject.toml | sed 's/version = "\(.*\)"/\1/')
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
PATCH=$((PATCH + 1))
NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

sed -i '' "s/version = \"${CURRENT}\"/version = \"${NEW_VERSION}\"/" pyproject.toml
echo -e "${DIM}  Version bumped: ${CURRENT} → ${NEW_VERSION}${NC}"

# ── 4. Clean previous builds ─────────────────────────────────────────────────
rm -rf dist/ build/ *.egg-info
echo -e "${DIM}  Cleaned previous builds${NC}"

# ── 5. Build sdist + wheel ────────────────────────────────────────────────────
echo -e "${CYAN}  Building sdist + wheel...${NC}"
python3 -m build
echo ""
echo -e "${GREEN}✓ Build complete${NC}"
ls -lh dist/
echo ""

# ── 6. Git commit, tag, push ──────────────────────────────────────────────────
echo -e "${CYAN}  Committing and tagging v${NEW_VERSION}...${NC}"
git add pyproject.toml api/ui_dist
git commit -m "release: v${NEW_VERSION}"
git tag "v${NEW_VERSION}"
git push origin HEAD
git push origin "v${NEW_VERSION}"
echo -e "${DIM}  Pushed commit and tag v${NEW_VERSION}${NC}"

# ── 7. Publish ────────────────────────────────────────────────────────────────
if [ "$1" == "--no-publish" ]; then
    echo -e "${GREEN}✓ Done — v${NEW_VERSION} (skipped PyPI upload)${NC}"
elif [ "$1" == "--test" ]; then
    echo -e "${CYAN}  Uploading to TestPyPI...${NC}"
    python3 -m twine upload --repository testpypi dist/*
    echo ""
    echo -e "${GREEN}✓ Published to TestPyPI${NC}"
    echo -e "  Install: pip install -i https://test.pypi.org/simple/ kubsome==${NEW_VERSION}"
else
    echo -e "${CYAN}  Uploading to PyPI...${NC}"
    python3 -m twine upload dist/*
    echo ""
    echo -e "${GREEN}✓ Published to PyPI — v${NEW_VERSION}${NC}"
    echo -e "  Install: pip install kubsome==${NEW_VERSION}"
fi

echo ""
