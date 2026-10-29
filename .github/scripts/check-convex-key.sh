#!/usr/bin/env bash
# Validate CONVEX_DEPLOY_KEY before any command uses it.
#
# The key is a deployment credential. Convex accepts exactly
# `prod:<deployment>|<token>` (or `dev:`). The dashboard's copy control has
# been observed to hand back a typographic vertical bar, to add invisible
# characters, and to drop the separator or the deployment name entirely. This
# script normalizes those presentation artifacts, validates the target against
# the deployment pinned in src/main.tsx, and writes the usable key to a
# runner-private file. Only the deployment name is ever printed.
set -euo pipefail

key="${CONVEX_DEPLOY_KEY:-}"
key="$(printf '%s' "$key" | tr -d '[:space:]')"

if [ -z "$key" ]; then
  echo "::error title=Convex deploy key missing::Add CONVEX_DEPLOY_KEY under Settings -> Secrets and variables -> Actions."
  exit 1
fi

# The frontend pins its backend in src/main.tsx; reading it here keeps the
# workflow and the bundle from drifting apart.
url="$(grep -m1 -oE 'https://[a-z0-9-]+\.convex\.cloud' src/main.tsx || true)"
expected="${url#https://}"
expected="${expected%.convex.cloud}"
if [ -z "$expected" ]; then
  echo "::error title=Cannot read Convex URL::src/main.tsx has no https://<deployment>.convex.cloud URL."
  exit 1
fi

# Normalize the artifacts the copy control can introduce. The key itself must
# be ASCII: no invisible characters, no typographic bar.
original="$key"
key="${key//│/|}"
key="${key//｜/|}"
key="${key//$'\u200B'/}"
key="${key//$'\u200C'/}"
key="${key//$'\u200D'/}"
key="${key//$'\uFEFF'/}"
key="${key//$'\u00A0'/}"
key="${key//$'\u202F'/}"
key="${key//$'\u2007'/}"
if [ "$key" != "$original" ]; then
  echo "::notice::Normalized invisible characters in CONVEX_DEPLOY_KEY."
fi

case "$key" in
  prod:*|dev:*) ;;
  *)
    echo "::error title=Convex deploy key malformed::The secret must start with prod: or dev:. Generate a deploy key in the Convex dashboard and replace the secret."
    exit 1
    ;;
esac

# Some copies omit the deployment name entirely: `prod:eyJ...`. The token
# cannot be used without its name, and the app has exactly one valid target.
if [[ "$key" == prod:eyJ* || "$key" == dev:eyJ* ]]; then
  scheme="${key%%:*}"
  rest="${key#*:}"
  key="${scheme}:${expected}|${rest}"
  echo "::notice::Recovered the deployment name from the app's pinned URL."
fi

# Other copies join the deployment name and token with no separator at all.
# Convex tokens are JWT-like and start with the base64 of a JSON header,
# `eyJ`; a deployment name cannot contain that sequence.
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
    echo "::error title=Convex deploy key malformed::The deployment name in the key is not a valid Convex deployment name (length ${#name}). Copy the key again; it must read prod:<deployment>|<token>."
    exit 1
    ;;
esac

if [ "$name" != "$expected" ]; then
  echo "::error title=Wrong Convex deployment::The key targets $name, but the app is pinned to $expected. Generate a deploy key for $expected and replace CONVEX_DEPLOY_KEY."
  exit 1
fi

# The workflows read this file rather than the raw secret, so they use the
# trimmed, normalized value that was actually validated. The runner is
# ephemeral and the file is owner-only.
key_file="${RUNNER_TEMP:-/tmp}/convex-deploy-key"
umask 077
printf '%s' "$key" > "$key_file"
chmod 600 "$key_file"

echo "Deploy key targets $target, matching the app's pinned deployment."
