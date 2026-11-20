#!/usr/bin/env bash
# Deploy the Convex backend from a shell.
#
# A production deploy key is `prod:<deployment>|<token>`, but the dashboard's
# copy control has been seen to hand the key back with the separator URL-encoded
# as `%7C`, as a typographic bar, or with invisible characters added. The Convex
# CLI only splits on `|`; when there is none it reports "set CONVEX_DEPLOY_KEY to
# a new key", which reads like an expired key and is not one.
#
# The GitHub workflow already repairs the copy with
# .github/scripts/check-convex-key.sh. This wrapper runs the same check before a
# shell deploy, so a mangled copy cannot look like a dead key again, and the two
# paths cannot disagree about which deployment is being pushed to.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

bash "$root/.github/scripts/check-convex-key.sh"

# The check writes the trimmed, normalised, deployment-checked key here. Deploy
# with that value rather than the raw environment one, then take it off disk.
key_file="${RUNNER_TEMP:-/tmp}/convex-deploy-key"
if [ ! -s "$key_file" ]; then
  echo "convex-deploy: the deploy key check did not write a key." >&2
  exit 1
fi
CONVEX_DEPLOY_KEY="$(cat "$key_file")"
export CONVEX_DEPLOY_KEY
rm -f "$key_file"

# Typechecking stays off for the same reason as in CI: it runs before the
# gitignored src/convex/_generated client is regenerated. This deploy generates
# it, and `bunx tsc -b` afterwards is the typecheck.
exec bunx convex deploy --typecheck disable "$@"
