#!/usr/bin/env bash
# Compare one Python art generator with its TypeScript port in an isolated container.
#
# Usage, from the repository root:
#   PARITY_BASE=<commit> PARITY_SCRATCH=<dir> PARITY_NODE_MODULES=<dir> \
#   PARITY_SITE_PACKAGES=<dir> art/tools/parity.sh TOOL ARGS...
#
#   art/tools/parity.sh palette build
#   art/tools/parity.sh palette preview '{out}/palette.png'
#
# PARITY_BASE           commit whose Python generators produce the reference outputs
# PARITY_SCRATCH        writable directory for the two repository copies and the results
# PARITY_NODE_MODULES   node_modules installed offline from this checkout's package-lock.json
# PARITY_SITE_PACKAGES  site-packages holding the requirements-art.txt pins (art-kit, Pillow)
# PARITY_IMAGE          container image with Node 24.21 and Python 3.12
#                       (default game-check:node24.21.0-python3.12)
#
# The Python copy is `git archive PARITY_BASE`; the TypeScript copy is this working tree's tracked
# and untracked, non-ignored files. Each run starts from fresh copies under
# PARITY_SCRATCH/<label>.XXXXXX/{py,ts} and writes PARITY_SCRATCH/results/<label>.json, where label is
# TOOL and its arguments without {out}. ARGS containing {out} name each copy's .parity-out
# directory. The container has no network, four CPUs and a read-only root; dependencies are
# mounted read-only. Generators that call Aseprite need an image that provides it.
set -euo pipefail

if [ "$#" -lt 1 ]; then
  sed -n '2,24p' "$0" >&2
  exit 2
fi
: "${PARITY_BASE:?PARITY_BASE is required}"
: "${PARITY_SCRATCH:?PARITY_SCRATCH is required}"
: "${PARITY_NODE_MODULES:?PARITY_NODE_MODULES is required}"
: "${PARITY_SITE_PACKAGES:?PARITY_SITE_PACKAGES is required}"
image=${PARITY_IMAGE:-game-check:node24.21.0-python3.12}
tool=$1
label=$tool
for arg in "${@:2}"; do
  case $arg in *'{out}'*) ;; *) label="$label-$arg" ;; esac
done

load=$(cut -d ' ' -f 1 /proc/loadavg)
if awk -v value="$load" 'BEGIN { exit !(value >= 24) }'; then
  echo "parity.sh: one-minute load $load is not below 24" >&2
  exit 3
fi

repo=$(git rev-parse --show-toplevel)
base=$(git -C "$repo" rev-parse --verify "$PARITY_BASE^{commit}")
scratch=$(realpath "$PARITY_SCRATCH")
mkdir -p "$scratch/results"
work=$(mktemp -d "$scratch/$label.XXXXXX")
run=$(basename "$work")
mkdir "$work/py" "$work/ts"
git -C "$repo" archive "$base" | tar -x -C "$work/py"
git -C "$repo" ls-files -z --cached --others --exclude-standard |
  (cd "$repo" && tar --null -T - -c) | tar -x -C "$work/ts"
ln -s /deps/node_modules "$work/py/node_modules"
ln -s /deps/node_modules "$work/ts/node_modules"

docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp --cpus 4 --network none \
  --read-only --tmpfs /tmp \
  -v "$scratch:/scratch" \
  -v "$(realpath "$PARITY_NODE_MODULES"):/deps/node_modules:ro" \
  -v "$(realpath "$PARITY_SITE_PACKAGES"):/deps/site-packages:ro" \
  "$image" bash -euo pipefail -c '
    if [ ! -x /scratch/venv/bin/python ]; then
      python3 -m venv --without-pip /scratch/venv
      site=$(/scratch/venv/bin/python -I -c "import sysconfig; print(sysconfig.get_path(\"purelib\"))")
      echo /deps/site-packages > "$site/parity-deps.pth"
    fi
    run=$1 label=$2
    shift 2
    cd "/scratch/$run/ts"
    exec node art/tools/parity.ts --tool "$1" --label "$label" --python /scratch/venv/bin/python \
      --py "/scratch/$run/py" --ts "/scratch/$run/ts" --results /scratch/results -- "${@:2}"
  ' parity "$run" "$label" "$tool" "${@:2}"
