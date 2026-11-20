#!/usr/bin/env bash
set -uo pipefail
package_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
result=0
printf '系统：%s %s\n' "$(uname -s)" "$(uname -m)"
getconf GNU_LIBC_VERSION || result=1
printf '图形桌面：DISPLAY=%s WAYLAND_DISPLAY=%s\n' "${DISPLAY:-未设置}" "${WAYLAND_DISPLAY:-未设置}"
for binary in "$package_dir/electron/electron" \
  "$package_dir/backend/app/deepseek_harness_runtime/runtime/deepseek-harness-sdk-runtime-linux-arm64"; do
  printf '\n依赖检查：%s\n' "$binary"
  if [[ ! -x "$binary" ]]; then
    printf '文件缺失或不可执行。\n'
    result=1
    continue
  fi
  dependencies="$(ldd "$binary" 2>&1)" || result=1
  printf '%s\n' "$dependencies"
  if [[ "$dependencies" == *'not found'* ]]; then result=1; fi
done
printf '\n用户命名空间上限：'
cat /proc/sys/user/max_user_namespaces || result=1
if command -v unshare >/dev/null 2>&1; then
  if unshare --user --map-root-user -- true; then
    printf '用户命名空间基础检测成功。Electron 图形启动仍需在目标机确认。\n'
  else
    printf '用户命名空间检测失败，请保留此输出和启动日志。\n'
    result=1
  fi
fi
exit "$result"
