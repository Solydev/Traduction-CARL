#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
runtime_dir="${CARL_RUNTIME_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/carl-traduction/runtime}"
if [[ $# -eq 0 ]]; then
  printf '\nCARL — V1.3.0 — fenêtre Chrome Windows\n1. Audit des six langues\n2. Corriger les six langues et sauvegarder\n3. Quitter\n'
  read -r -p 'Votre choix [1] : ' choice
  case "${choice:-1}" in
    1) set -- --audit --ask-start-profile ;;
    2) set -- --apply --ask-start-profile ;;
    3) exit 0 ;;
    *) printf '%s\n' 'Choix invalide.'; exit 1 ;;
  esac
fi
linux_engine=false
for arg in "$@"; do
  case "$arg" in --linux-engine|--local-display) linux_engine=true ;; esac
done
if [[ "$linux_engine" == false ]]; then
  windows_home="${CARL_WINDOWS_HOME:-}"
  if [[ -z "$windows_home" && "$script_dir" =~ ^(/mnt/[a-zA-Z]/Users/[^/]+) ]]; then
    windows_home="${BASH_REMATCH[1]}"
  fi
  windows_node="$windows_home/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe"
  windows_playwright="$windows_home/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  if [[ -f "$windows_node" && -d "$windows_playwright" ]]; then
    printf '%s\n' 'Ouverture de Chrome Windows avec les composants Codex déjà présents. Aucune installation.'
    exec env -u CARL_PLAYWRIGHT_MODULE "$windows_node" "$(wslpath -w "$script_dir/carl.cjs")" "$@"
  fi
  printf '%s\n' 'Composants Windows de Codex introuvables. Le lancement natif ne peut pas démarrer.'
  exit 1
fi
if ! command -v node >/dev/null; then
  printf '%s\n' 'Node.js est absent de cette distribution WSL.'
  exit 1
fi
if [[ -d "$runtime_dir/node_modules/playwright" ]]; then
  export CARL_PLAYWRIGHT_MODULE="$runtime_dir/node_modules/playwright"
elif ! node -e 'require("playwright")' >/dev/null 2>&1; then
  printf 'Exécutez d’abord : bash "%s/installer-wsl.sh"\n' "$script_dir"
  exit 1
fi
exec node "$script_dir/carl.cjs" "$@"
