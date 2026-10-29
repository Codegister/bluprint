#!/usr/bin/env bash
# Validate CONVEX_DEPLOY_KEY before any command uses it.
#
# The key is a deployment credential. It is trimmed (a copied key can carry a
# trailing newline, which Convex rejects), checked for the expected shape, and
# compared with the deployment pinned in src/main.tsx. Deploying to a different
# deployment would leave the live app on its old backend, so that is a hard
# failure rather than a warning.
#
# Only the deployment name is printed. The token after "|" never is.
set -euo pipefail

key="${CONVEX_DEPLOY_KEY:-}"
key="$(printf '%s' "$key" | tr -d '[:space:]')"

# The Convex dashboard's copy control can hand back a typographic vertical
# bar (U+2502 or U+FF5C) instead of ASCII |. Convex only accepts ASCII, so a
# correct key copied through that control would otherwise look malformed.
normalized="${key//│/|}"
normalized="${normalized//｜/|}"
if [ "$normalized" != "$key" ]; then
  echo "::notice::Replaced a typographic vertical bar in CONVEX_DEPLOY_KEY with ASCII |."
  key="$normalized"
fi

if [ -z "$key" ]; then
  echo "::error title=Convex deploy key missing::Add CONVEX_DEPLOY_KEY under Settings -> Secrets and variables -> Actions."
  exit 1
fi

case "$key" in
  prod:*|dev:*) ;;
  *)
    echo "::error title=Convex deploy key malformed::The secret must start with prod: or dev:. Generate a deploy key in the Convex dashboard and replace the secret."
    exit 1
    ;;
esac

# The dashboard's copy control has also been seen to join the deployment
# name and the token with no separator at all. Convex tokens are JWT-like and
# start with the base64 of a JSON header, `eyJ`; a deployment name cannot
# contain that sequence. Reinsert the separator only after the prod:/dev:
# prefix has been checked, and leave the token itself untouched.
if [[ "$key" != *"|"* && "$key" == *"eyJ"* ]]; then
  prefix="${key%%eyJ*}"
  token="${key#*eyJ}"
  key="${prefix}|eyJ${token}"
  echo "::notice::Inserted the missing | separator in CONVEX_DEPLOY_KEY."
fi

if [ "$key" = "${key%%|*}" ]; then
  echo "::error title=Convex deploy key malformed::The secret is only the deployment prefix. Copy the whole key; it must look like prod:<deployment>|<token>."
  exit 1
fi

target="${key%%|*}"       # e.g. prod:harmless-dog-538
name="${target#*:}"       # e.g. harmless-dog-538

case "$name" in
  ""|*[!a-z0-9-]*)
    echo "::error title=Convex deploy key malformed::The deployment name in the key is not a valid Convex deployment name."
    exit 1
    ;;
esac

# The frontend pins its backend in src/main.tsx; reading it here keeps the
# workflow and the bundle from drifting apart.
url="$(grep -m1 -oE 'https://[a-z0-9-]+\.convex\.cloud' src/main.tsx || true)"
expected="${url#https://}"
expected="${expected%.convex.cloud}"

if [ -z "$expected" ]; then
  echo "::error title=Cannot read Convex URL::src/main.tsx has no https://<deployment>.convex.cloud URL."
  exit 1
fi

if [ "$name" != "$expected" ]; then
  echo "::error title=Wrong Convex deployment::The key targets $name, but the app is pinned to $expected. Generate a deploy key for $expected and replace CONVEX_DEPLOY_KEY."
  exit 1
fi

# The workflows read this file rather than the raw secret, so they use the
# trimmed and normalized value that was actually validated. The runner is
# ephemeral and the file is owner-only.
key_file="${RUNNER_TEMP:-/tmp}/convex-deploy-key"
umask 077
printf '%s' "$key" > "$key_file"
chmod 600 "$key_file"

echo "Deploy key targets $target, matching the app's pinned deployment."
