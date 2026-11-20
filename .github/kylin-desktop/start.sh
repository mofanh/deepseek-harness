#!/usr/bin/env bash
set -euo pipefail
umask 077
package_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
if [[ "$(uname -s)" != Linux || "$(uname -m)" != aarch64 ]]; then
  printf '此包需要 Linux ARM64（aarch64）。\n' >&2
  exit 1
fi
if [[ "$EUID" == 0 ]]; then
  printf '请使用桌面普通用户启动 DSH。\n' >&2
  exit 1
fi
if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  printf '没有检测到图形桌面。请在麒麟桌面的终端中启动。\n' >&2
  exit 1
fi
export DSH_HOME="${DSH_HOME:-$HOME/.dsh-intranet}"
export DSH_TELEMETRY_DISABLED=1
mkdir -p -- "$DSH_HOME/logs"
log="$DSH_HOME/logs/desktop-launch-$(date +%Y%m%d-%H%M%S)-$$.log"
printf '正在启动 DSH，首次启动可能需要一些时间。\n启动日志：%s\n' "$log"
cd -- "${DSH_WORKSPACE:-$HOME}"
unset ELECTRON_RUN_AS_NODE NODE_OPTIONS NODE_PATH
# Use the kernel user-namespace sandbox; this portable tree has no root-owned SUID helper.
exec "$package_dir/electron/electron" --disable-setuid-sandbox "$package_dir/electron/resources/app" \
  > >(tee -a "$log") 2> >(tee -a "$log" >&2)
