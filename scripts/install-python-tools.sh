#!/usr/bin/env bash
set -euo pipefail

python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 12) else "Python 3.12 or newer is required")'
python3 -m venv .venv-art
.venv-art/bin/python -m pip install --disable-pip-version-check --no-cache-dir \
  --requirement requirements-art.txt
bash scripts/install-ruff.sh
