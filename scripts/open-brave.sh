#!/usr/bin/env bash
set -euo pipefail
case "$(uname -s)" in
  Darwin) exec /usr/bin/open -a "Brave Browser" "$@" ;;
  *)
    for browser in brave-browser brave-browser-stable brave; do
      if command -v "$browser" >/dev/null 2>&1; then exec "$browser" "$@"; fi
    done
    printf '%s\n' 'Brave is unavailable. Open the printed URL in Brave manually.' >&2
    exit 1
    ;;
esac
