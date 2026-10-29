#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
runtime_dir="${CARL_RUNTIME_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/carl-traduction/runtime}"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  printf '%s\n' 'Node.js et npm sont nécessaires dans Ubuntu. Aucune installation Windows ne sera utilisée.'
  exit 1
fi
package_version="$(node -p 'require(process.argv[1]).dependencies.playwright' "$script_dir/package.json")"
printf 'Installation du module dans %s\n' "$runtime_dir"
mkdir -p -- "$runtime_dir"
npm install --prefix "$runtime_dir" --prefer-offline --no-audit --no-fund "playwright@$package_version"
export PLAYWRIGHT_SKIP_BROWSER_GC=1
node "$runtime_dir/node_modules/playwright/cli.js" install chromium
printf '\nInstallation locale WSL terminée. Aucune commande sudo exécutée.\n'
printf 'Diagnostic : bash "%s/lancer-wsl.sh" --diagnostic\n' "$script_dir"
printf '%s\n' 'Si Playwright signale des bibliothèques Linux manquantes au lancement, utilisez sa commande install-deps chromium dans Ubuntu.'
