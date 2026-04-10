#!/usr/bin/env bash
set -euo pipefail

echo "Copilot auth test container"
echo "copilot: $(copilot --version 2>/dev/null || true)"
python - <<'PY'
try:
    import copilot
    try:
        from importlib.metadata import version
        print(f"github-copilot-sdk: {version('github-copilot-sdk')}")
    except Exception:
        print("github-copilot-sdk: installed")
except Exception as exc:
    print(f"github-copilot-sdk import failed: {exc}")
PY
echo "HOME=${HOME}"
echo "copilot config dir: ${HOME}/.copilot"
echo "keyring shell: /opt/copilot-auth-test/keyring-session.sh"

exec "$@"