#!/usr/bin/env bash
#
# Setup script for the unattended agent environment (Telehealth-agents).
#
# Point the cloud environment's "setup script" at this file. It makes sure the
# sandbox has a Node version Angular 17 will actually accept, then installs the
# dependencies, so the nightly ticket runner can build and test before it opens
# a PR instead of pushing code it has never run.
#
# Safe to re-run: a usable Node and an existing node_modules short-circuit the
# expensive steps.
#
# See AGENT-ENVIRONMENT.md for the egress the sandbox needs.

set -euo pipefail

REQUIRED_MAJOR=18
REQUIRED_MINOR=13
TARGET_VERSION="20"

log()  { printf '[agent-setup] %s\n' "$*"; }
fail() { printf '[agent-setup] ERROR: %s\n' "$*" >&2; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# 1. Is the Node already here good enough?
#
# Angular 17's CLI refuses to start below 18.13 with a bare error message and a
# zero exit code in some shells, which is exactly the kind of failure that
# looks like "the tests passed" from the outside. Check it explicitly.
# ---------------------------------------------------------------------------

node_is_usable() {
  command -v node >/dev/null 2>&1 || return 1

  local raw major minor
  raw="$(node --version 2>/dev/null)" || return 1
  raw="${raw#v}"
  major="${raw%%.*}"
  minor="${raw#*.}"
  minor="${minor%%.*}"

  [[ "$major" -gt "$REQUIRED_MAJOR" ]] && return 0
  [[ "$major" -eq "$REQUIRED_MAJOR" && "$minor" -ge "$REQUIRED_MINOR" ]] && return 0
  return 1
}

if node_is_usable; then
  log "Node $(node --version) is new enough for Angular 17."
else
  if command -v node >/dev/null 2>&1; then
    log "Node $(node --version) is too old; Angular 17 needs >= ${REQUIRED_MAJOR}.${REQUIRED_MINOR}."
  else
    log "No Node found."
  fi

  # -------------------------------------------------------------------------
  # 2. Install Node via nvm.
  #
  # nvm is used rather than a distro package because it needs no root and
  # pins an exact major. Both downloads below can be refused by the egress
  # proxy, so say which one failed.
  # -------------------------------------------------------------------------

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    log "Installing nvm."
    mkdir -p "$NVM_DIR"

    if ! curl -fsSL --max-time 120 \
        https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash; then
      fail "could not install nvm.

This is almost certainly the egress proxy. Allowlist these on the agent
environment and re-run:

  raw.githubusercontent.com
  github.com
  objects.githubusercontent.com
  nodejs.org

To see what the proxy is refusing, run inside the sandbox:

  curl -sS \"\$HTTPS_PROXY/__agentproxy/status\"

See AGENT-ENVIRONMENT.md for the alternative (a prebuilt image carrying Node)."
    fi
  fi

  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"

  log "Installing Node ${TARGET_VERSION}."
  if ! nvm install "$TARGET_VERSION"; then
    fail "nvm could not download Node ${TARGET_VERSION}; nodejs.org is most likely blocked."
  fi

  nvm alias default "$TARGET_VERSION" >/dev/null 2>&1 || true
  nvm use "$TARGET_VERSION" >/dev/null

  # -------------------------------------------------------------------------
  # 3. Persist for the agent's later shells.
  #
  # The setup script and the agent's Bash calls are separate shells, so the
  # nvm activation above would not survive on its own.
  # -------------------------------------------------------------------------

  PROFILE="$HOME/.bashrc"
  MARKER="# added by agent-setup.sh (TeleHealthFE)"

  if [[ -f "$PROFILE" ]] && grep -qF "$MARKER" "$PROFILE"; then
    log "nvm already wired into ${PROFILE}."
  else
    {
      echo ""
      echo "$MARKER"
      echo "export NVM_DIR=\"$NVM_DIR\""
      echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"'
    } >> "$PROFILE"
    log "Wired nvm into ${PROFILE}."
  fi

  node_is_usable || fail "Node is still unusable after install: $(node --version 2>&1)"
  log "Node is now $(node --version)."
fi

# ---------------------------------------------------------------------------
# 4. Install dependencies.
#
# This doubles as the proof that registry.npmjs.org is reachable. Better to
# find that out during setup than three steps into a ticket.
# ---------------------------------------------------------------------------

if [[ -d node_modules ]] && [[ -f node_modules/.package-lock.json ]]; then
  log "node_modules already present; skipping install."
else
  log "Running npm ci (this also verifies registry.npmjs.org is reachable)."
  if ! npm ci; then
    fail "npm ci failed.

If the output mentions a network or proxy error, registry.npmjs.org is not
reachable and the agent can build nothing. Treat the environment as unready."
  fi
fi

# ---------------------------------------------------------------------------
# 5. Prove the toolchain actually runs.
# ---------------------------------------------------------------------------

log "Angular CLI: $(node node_modules/@angular/cli/bin/ng.js version --help >/dev/null 2>&1 && echo ok || echo 'not runnable')"
log "Environment ready. Node $(node --version), npm $(npm --version)."
