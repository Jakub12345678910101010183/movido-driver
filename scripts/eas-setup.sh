#!/usr/bin/env bash
# One-time EAS setup for MOViDO Driver. Run from the movido-driver folder after
# `eas login` (or with EXPO_TOKEN set). Safe to run again.
#
#  1. Links this app to its Expo project (reuses an existing
#     "movido-driver" project on your account; never creates a duplicate
#     when one exists) and stores the projectId in app.json.
#  2. Copies the three PUBLIC client values from your local .env into EAS
#     environment variables for "preview" and "production". Values are read
#     from the file and never printed.
#
# EXPO_PUBLIC_TOMTOM_API_KEY must be the NATIVE key ("API key Movido"),
# never the domain-restricted web key.
set -euo pipefail
cd "$(dirname "$0")/.."
EAS="npx --yes eas-cli@latest"

$EAS whoami >/dev/null 2>&1 || { echo "Not logged in to Expo. Run: eas login"; exit 1; }
echo "Expo account: $($EAS whoami 2>/dev/null | head -1)"

PID=$(node -e "console.log(require('./app.json').expo.extra?.eas?.projectId||'')")
if [ -z "$PID" ]; then
  $EAS init --non-interactive
  PID=$(node -e "console.log(require('./app.json').expo.extra?.eas?.projectId||'')")
fi
[ -n "$PID" ] || { echo "No projectId after eas init"; exit 1; }
echo "EAS projectId: $PID"

[ -f .env ] || { echo "Missing .env (copy .env.example and fill in the public values)"; exit 1; }
for NAME in EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY EXPO_PUBLIC_TOMTOM_API_KEY; do
  VALUE=$(grep -E "^${NAME}=" .env | head -1 | cut -d= -f2-)
  [ -n "$VALUE" ] || { echo "Missing $NAME in .env"; exit 1; }
  VIS=sensitive; [ "$NAME" = EXPO_PUBLIC_SUPABASE_URL ] && VIS=plaintext
  for ENVIRONMENT in preview production; do
    $EAS env:create --name "$NAME" --value "$VALUE" --environment "$ENVIRONMENT" --visibility "$VIS" \
      --scope project --type string --force --non-interactive >/dev/null
    echo "set $NAME for $ENVIRONMENT ($VIS)"
  done
done
echo "Done. Variable names:"; $EAS env:list preview --format short 2>/dev/null | grep -oE "^EXPO_PUBLIC_[A-Z_]+" | sort -u
