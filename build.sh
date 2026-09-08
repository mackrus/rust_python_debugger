#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Building Rust + WASM Python Debugger Engine..."
wasm-pack build --target web --out-dir web/pkg --release

# Remove wasm-pack auto-generated .gitignore so GitHub Pages deployment includes wasm assets
rm -f web/pkg/.gitignore

# Create .nojekyll for GitHub Pages
touch web/.nojekyll

echo "==> Build successful! Assets generated in web/pkg"
