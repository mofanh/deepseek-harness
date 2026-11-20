#!/usr/bin/env bash
set -u
package_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
binary="$package_dir/app/deepseek_harness_runtime/runtime/deepseek-harness-sdk-runtime-linux-arm64"
failed=0
printf '===== 系统 =====\n'
uname -smr
if [[ "$(uname -s)" != Linux || "$(uname -m)" != aarch64 ]]; then
  printf '失败：需要 Linux ARM64（aarch64）。\n'
  exit 1
fi
printf '\n===== glibc =====\n'
libc_version="$(getconf GNU_LIBC_VERSION 2>/dev/null)"
printf '%s\n' "$libc_version"
if ! printf '%s\n' "$libc_version" | awk '$1 == "glibc" { split($2, v, "."); if (v[1] > 2 || (v[1] == 2 && v[2] >= 28)) ok=1 } END { exit !ok }'; then
  printf '失败：需要 glibc 2.28 或更高版本。\n'
  failed=1
fi
printf '\n===== DSH =====\n'
export DSH_HOME="${DSH_HOME:-$HOME/.dsh-intranet}"
export DSH_TELEMETRY_DISABLED=1
if [[ -x "$binary" ]]; then
  if ! "$binary" --version; then failed=1; fi
else
  printf '失败：程序缺失或没有执行权限。\n'
  failed=1
fi
printf '\n===== bwrap 沙箱基础检查 =====\n'
if command -v bwrap >/dev/null 2>&1 && command -v timeout >/dev/null 2>&1; then
  bwrap --version
  if timeout 10s bwrap --ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent -- /usr/bin/true; then
    printf '通过。\n'
  else
    printf '失败：沙箱基础检查未通过，请保留上方报错。\n'
    failed=1
  fi
else
  printf '失败：未找到 bwrap 或 timeout。\n'
  failed=1
fi
printf '\n===== 可用资源 =====\n'
free -h
df -h "$package_dir" "$HOME" /tmp
printf '\n检查退出码：%s\n' "$failed"
exit "$failed"
