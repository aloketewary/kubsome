#!/bin/bash
# Kubsome - Build & Publish to PyPI
# Usage: ./publish.sh [--test] [--no-publish] [--no-commit] [--no-bump]
#
# Flags (chainable in any order):
#   --no-publish   Skip PyPI upload
#   --no-commit    Skip git commit/tag/push (only build + copy)
#   --no-bump      Skip version bump
#   --test         Upload to TestPyPI instead of PyPI

set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
DIM='\033[2m'
NC='\033[0m'

die() { echo -e "${RED}x $1${NC}"; exit 1; }

# Parse flags
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
echo -e "${GREEN}Kubsome - Build & Publish${NC}"
echo "-------------------------------"
echo -e "${DIM}  publish=$DO_PUBLISH commit=$DO_COMMIT bump=$DO_BUMP test=$USE_TEST${NC}"
echo ""

# Pre-flight checks
command -v python3 >/dev/null || die "python3 not found"
command -v npm >/dev/null || die "npm not found"
python3 -c "import build" 2>/dev/null || die "python build not installed (pip install build)"
if [ "$DO_PUBLISH" = true ]; then
    python3 -c "import twine" 2>/dev/null || die "twine not installed (pip install twine)"
fi
echo -e "${DIM}  Pre-flight checks passed${NC}"

# Build Angular UI
 echo -e "${CYAN}  Building Angular UI...${NC}"
cd ui
npm ci
npm run build -- --configuration production
cd ..

# Validate and atomically replace bundled UI
bash scripts/sync-ui-dist.sh
echo -e "${DIM}  Bundled UI contains $(find api/ui_dist -type f | wc -l | tr -d ' ') files${NC}"

# Bump version (patch)
CURRENT=$(grep '^version' pyproject.toml | sed 's/version = "\(.*\)"/\1/')

if [ "$DO_BUMP" = true ]; then
    IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
    PATCH=$((PATCH + 1))
    NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/version = \"${CURRENT}\"/version = \"${NEW_VERSION}\"/" pyproject.toml
    else
        sed -i "s/version = \"${CURRENT}\"/version = \"${NEW_VERSION}\"/" pyproject.toml
    fi
    echo -e "${DIM}  Version bumped: ${CURRENT} -> ${NEW_VERSION}${NC}"
else
    NEW_VERSION="$CURRENT"
    echo -e "${DIM}  Version: ${NEW_VERSION} (no bump)${NC}"
fi

# Clean previous builds
rm -rf dist/ build/ *.egg-info
echo -e "${DIM}  Cleaned previous builds${NC}"

# Build sdist + wheel
echo -e "${CYAN}  Building sdist + wheel...${NC}"
python3 -m build
echo ""
echo -e "${GREEN}Build complete${NC}"
ls -lh dist/
echo ""

# Reinstall locally (editable)
echo -e "${CYAN}  Reinstalling locally...${NC}"
pip3 install -e . --break-system-packages --quiet 2>/dev/null || pip3 install -e . --quiet 2>/dev/null || true
echo -e "${DIM}  Local install updated to v${NEW_VERSION}${NC}"

# Git commit, tag, push
if [ "$DO_COMMIT" = true ]; then
    echo -e "${CYAN}  Committing and tagging v${NEW_VERSION}...${NC}"
    git add -A
    git commit -m "release: v${NEW_VERSION}" || echo -e "${DIM}  Nothing new to commit${NC}"
    git tag -f "v${NEW_VERSION}"
    git push origin HEAD
    git push origin "v${NEW_VERSION}" --force
    echo -e "${DIM}  Pushed commit and tag v${NEW_VERSION}${NC}"
else
    echo -e "${YELLOW}  Skipping git commit/tag/push${NC}"
fi

# Publish
if [ "$DO_PUBLISH" = false ]; then
    echo -e "${GREEN}Done - v${NEW_VERSION} (skipped PyPI upload)${NC}"
elif [ "$USE_TEST" = true ]; then
    echo -e "${CYAN}  Uploading to TestPyPI...${NC}"
    python3 -m twine upload --repository testpypi dist/*
    echo ""
    echo -e "${GREEN}Published to TestPyPI${NC}"
    echo -e "  Install: pip install -i https://test.pypi.org/simple/ kubsome==${NEW_VERSION}"
else
    echo -e "${CYAN}  Uploading to PyPI...${NC}"
    python3 -m twine upload dist/*
    echo ""
    echo -e "${GREEN}Published to PyPI - v${NEW_VERSION}${NC}"
    echo -e "  Install: pip install kubsome==${NEW_VERSION}"
fi

echo ""
