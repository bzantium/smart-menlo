#!/bin/bash
set -e

HOST_NAME="com.smartmenlo.sessiond"
INSTALL_DIR="$HOME/.smartmenlo"
HOST_SCRIPT="$INSTALL_DIR/sessiond"

# Chrome & Chromium-based browsers
BROWSERS=(
  "$HOME/Library/Application Support/Google/Chrome"
  "$HOME/Library/Application Support/Chromium"
  "$HOME/Library/Application Support/Microsoft Edge"
  "$HOME/Library/Application Support/Arc/User Data"
)

# Auto-detect extension ID from browser profiles
detect_extension_id() {
  python3 -c "
import json, glob, sys
for base in sys.argv[1:]:
    for pref in glob.glob(base + '/*/Secure Preferences'):
        try:
            with open(pref) as f:
                data = json.load(f)
            for ext_id, info in data.get('extensions', {}).get('settings', {}).items():
                if 'smart-menlo' in info.get('path', '').lower():
                    print(ext_id)
                    raise SystemExit(0)
        except (json.JSONDecodeError, KeyError):
            pass
" "${BROWSERS[@]}" 2>/dev/null
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NATIVE_SRC="$SCRIPT_DIR/native/com.smartmenlo.sessiond.py"

if [ ! -f "$NATIVE_SRC" ]; then
  echo "Error: $NATIVE_SRC not found. Run this script from the repo root."
  exit 1
fi

echo "Smart Menlo Session Helper - Installer"
echo "======================================="
echo ""

# Detect extension ID
echo "→ Detecting extension ID ..."
EXT_ID=$(detect_extension_id)
if [ -z "$EXT_ID" ]; then
  echo "  ✗ Smart Menlo extension not found in any browser."
  echo "  Install the extension first, then re-run this script."
  exit 1
fi
echo "  ✓ $EXT_ID"
echo ""

MANIFEST="{
  \"name\": \"$HOST_NAME\",
  \"description\": \"Smart Menlo session daemon\",
  \"path\": \"$HOST_SCRIPT\",
  \"type\": \"stdio\",
  \"allowed_origins\": [
    \"chrome-extension://$EXT_ID/\"
  ]
}"

# Install the native host script
echo "→ Installing native host to $HOST_SCRIPT ..."
mkdir -p "$INSTALL_DIR"
cp "$NATIVE_SRC" "$HOST_SCRIPT"
chmod 755 "$HOST_SCRIPT"

# Install manifests for detected browsers
installed=0
for base in "${BROWSERS[@]}"; do
  nmh_dir="$base/NativeMessagingHosts"
  parent="$(dirname "$nmh_dir")"
  if [ -d "$parent" ] && [ -w "$parent" ]; then
    mkdir -p "$nmh_dir" 2>/dev/null || continue
    echo "$MANIFEST" > "$nmh_dir/$HOST_NAME.json" 2>/dev/null || continue
    echo "  ✓ $(basename "$base")"
    installed=$((installed + 1))
  fi
done

if [ "$installed" -eq 0 ]; then
  nmh_dir="${BROWSERS[0]}/NativeMessagingHosts"
  mkdir -p "$nmh_dir"
  echo "$MANIFEST" > "$nmh_dir/$HOST_NAME.json"
  echo "  ✓ Chrome (default)"
fi

echo ""
echo "Done! Reload the extension at chrome://extensions to apply."
