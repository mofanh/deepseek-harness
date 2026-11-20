#!/usr/bin/env bash
set -euo pipefail
package_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
binary="$package_dir/app/deepseek_harness_runtime/runtime/deepseek-harness-sdk-runtime-linux-arm64"
if [[ "$(uname -s)" != Linux || "$(uname -m)" != aarch64 ]]; then
  printf '此包需要 Linux ARM64（aarch64）。\n' >&2
  exit 1
fi
if [[ ! -x "$binary" ]]; then
  printf '找不到可执行的 DSH 程序：%s\n请检查是否完整解压，并保留文件执行权限。\n' "$binary" >&2
  exit 1
fi
export DSH_HOME="${DSH_HOME:-$HOME/.dsh-intranet}"
export DSH_TELEMETRY_DISABLED=1
mkdir -p -- "$DSH_HOME"
cd -- "${DSH_WORKSPACE:-$HOME}"
exec "$binary" web "$@"
