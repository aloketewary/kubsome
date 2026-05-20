#!/bin/bash
# Kubsome — Build & Publish to PyPI
# Usage: ./publish.sh [--test] [--no-publish] [--no-commit] [--no-bump]
#
# Flags (chainable in any order):
#   --no-publish   Skip PyPI upload
#   --no-commit    Skip git commit/tag/push (only build + copy)
#   --no-bump      Skip version bump
#   --test         Upload to TestPyPI instead of PyPI

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
DIM='\033[2m'
NC='\033[0m'

# ── Parse flags ───────────────────────────────────────────────────────────────
DO_PUBLISH=true
DO_COMMIT=true
DO_BUMP=true
USE_TEST=false

for arg in "$@"; do
    case "$arg" in
        --no-publish) DO_PUBLISH=false ;;
        --no-commit)  DO_COMMIT=false ;;
        --no-bump)    DO_BUMP=false ;;
        --test)       USE_TEST=true ;;
        *)
            echo -e "${YELLOW}Unknown flag: $arg${NC}"
            echo "Usage: ./publish.sh [--test] [--no-publish] [--no-commit] [--no-bump]"
            exit 1
            ;;
    esac
done

echo ""
echo -e "${GREEN}◆ Kubsome — Build & Publish${NC}"
echo "───────────────────────────────"
echo -e "${DIM}  publish=$DO_PUBLISH commit=$DO_COMMIT bump=$DO_BUMP test=$USE_TEST${NC}"
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

if [ "$DO_BUMP" = true ]; then
    IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
    PATCH=$((PATCH + 1))
    NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
    sed -i '' "s/version = \"${CURRENT}\"/version = \"${NEW_VERSION}\"/" pyproject.toml
    echo -e "${DIM}  Version bumped: ${CURRENT} → ${NEW_VERSION}${NC}"
else
    NEW_VERSION="$CURRENT"
    echo -e "${DIM}  Version: ${NEW_VERSION} (no bump)${NC}"
fi

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
if [ "$DO_COMMIT" = true ]; then
    echo -e "${CYAN}  Committing and tagging v${NEW_VERSION}...${NC}"
    git add pyproject.toml api/ui_dist
    git commit -m "release: v${NEW_VERSION}"
    git tag "v${NEW_VERSION}"
    git push origin HEAD
    git push origin "v${NEW_VERSION}"
    echo -e "${DIM}  Pushed commit and tag v${NEW_VERSION}${NC}"
else
    echo -e "${YELLOW}  Skipping git commit/tag/push${NC}"
fi

# ── 7. Publish ────────────────────────────────────────────────────────────────
if [ "$DO_PUBLISH" = false ]; then
    echo -e "${GREEN}✓ Done — v${NEW_VERSION} (skipped PyPI upload)${NC}"
elif [ "$USE_TEST" = true ]; then
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
