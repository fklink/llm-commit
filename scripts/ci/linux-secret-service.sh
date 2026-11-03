#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077

session() {
  set +x
  set -euo pipefail
  umask 077
  fail() { printf 'Secret Service: %s\n' "$1" >&2; exit 1; }
  bus_call() {
    gdbus call --session --timeout 2 --dest org.freedesktop.DBus \
      --object-path /org/freedesktop/DBus --method "org.freedesktop.DBus.$1" org.freedesktop.secrets 2>/dev/null
  }
  service_call() {
    local method=$1
    shift
    gdbus call --session --timeout 2 --dest org.freedesktop.secrets \
      --object-path /org/freedesktop/secrets --method "org.freedesktop.Secret.Service.$method" "$@" 2>/dev/null
  }
  collection_locked() {
    gdbus call --session --timeout 2 --dest org.freedesktop.secrets --object-path "$1" \
      --method org.freedesktop.DBus.Properties.Get org.freedesktop.Secret.Collection Locked 2>/dev/null
  }

  local fixture=$1
  shift
  [[ -n ${DBUS_SESSION_BUS_ADDRESS:-} ]] || fail "D-Bus session unavailable"
  local owned
  owned=$(bus_call NameHasOwner) || fail "D-Bus session unavailable"
  [[ "$owned" == "(false,)" ]] || fail "session already has a Secret Service"

  local password
  export -n password
  password=$(openssl rand -hex 32) || fail "test keyring password generation failed"
  [[ "$password" =~ ^[0-9a-f]{64}$ ]] || fail "invalid test keyring password"
  gnome-keyring-daemon --foreground --unlock --components=secrets --control-directory="$fixture/control" \
    < <(printf '%s' "$password") >/dev/null 2>&1 &
  local keyring_pid=$!
  unset password
  trap "kill $keyring_pid 2>/dev/null || true; wait $keyring_pid 2>/dev/null || true" EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  local owner='' attempt
  for ((attempt = 0; attempt < 12; attempt++)); do
    owner=$(bus_call GetConnectionUnixProcessID) || owner=''
    [[ -z "$owner" ]] || break
    sleep 0.25
  done
  [[ -n "$owner" ]] || fail "Secret Service did not become available"
  [[ "$owner" == "(uint32 $keyring_pid,)" ]] || fail "unexpected Secret Service owner"

  local alias_result collection pattern='/org/freedesktop/secrets/collection/[A-Za-z0-9_]+'
  alias_result=$(service_call ReadAlias default) || fail "cannot query default collection"
  if [[ "$alias_result" == "(objectpath '/',)" ]]; then
    collection=/org/freedesktop/secrets/collection/login
    [[ "$(collection_locked "$collection")" == "(<false>,)" ]] || fail "login collection is unavailable or locked"
    service_call SetAlias default "$collection" >/dev/null || fail "cannot assign default collection"
    alias_result=$(service_call ReadAlias default) || fail "cannot query assigned collection"
  fi
  [[ "$alias_result" =~ $pattern ]] || fail "default collection is unavailable"
  collection=${BASH_REMATCH[0]}
  local locked
  locked=$(collection_locked "$collection") || fail "default collection is unavailable"
  [[ "$locked" == "(<false>,)" ]] || fail "default collection is locked"

  local dummy=llm-commit-secret-service-dummy retrieved items
  printf '%s' "$dummy" | timeout 10 secret-tool store --label="LLM Commit CI dummy" llm-commit-probe roundtrip >/dev/null 2>&1 \
    || fail "Secret Service store failed"
  retrieved=$(timeout 10 secret-tool lookup llm-commit-probe roundtrip 2>/dev/null) || fail "Secret Service lookup failed"
  [[ "$retrieved" == "$dummy" ]] || fail "Secret Service roundtrip mismatch"
  timeout 10 secret-tool clear llm-commit-probe roundtrip >/dev/null 2>&1 || fail "Secret Service probe cleanup failed"
  items=$(service_call SearchItems "{}") || fail "cannot verify empty test keyring"
  [[ "$items" != *"$collection/"* ]] || fail "test keyring must be empty before VS Code"
  printf 'Secret Service: isolated D-Bus owner, unlocked collection and store/read/clear verified\n'

  xvfb-run -a "$@" || fail "Linux host tests failed"
  [[ "$(bus_call GetConnectionUnixProcessID)" == "$owner" ]] || fail "Secret Service owner changed during tests"
  items=$(service_call SearchItems "{}") || fail "cannot verify host keyring use"
  [[ "$items" == *"$collection/"* ]] || fail "No host keyring item observed"
  printf 'Secret Service: encrypted host keyring item observed\n'
}

private_root=$(cd -- "${LLM_CI_PRIVATE:?Set LLM_CI_PRIVATE}" && pwd -P)
fixture=$(mktemp -d "$private_root/secret-service.XXXXXXXX")
trap 'if [[ "$fixture" == "$private_root"/secret-service.* ]]; then rm -rf -- "$fixture"; fi' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir -- "$fixture/data" "$fixture/config" "$fixture/cache" "$fixture/runtime" "$fixture/control"
export XDG_DATA_HOME="$fixture/data" XDG_CONFIG_HOME="$fixture/config"
export XDG_CACHE_HOME="$fixture/cache" XDG_RUNTIME_DIR="$fixture/runtime"
unset GNOME_KEYRING_CONTROL GNOME_KEYRING_PID
dbus-run-session -- bash -c "$(declare -f session); session \"\$@\"" bash "$fixture" "$@"
