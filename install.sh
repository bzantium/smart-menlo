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

read -r -d '' SCRIPT << 'PYEOF' || true
#!/usr/bin/env python3
"""Native messaging host for Smart Menlo - reads GlobalProtect VPN session info."""
import json,struct,sys,os,re
from datetime import datetime

LOG="/Library/Logs/PaloAltoNetworks/GlobalProtect/pan_gp_event.log"
C=re.compile(r"^(\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}):\d+ \[Info \]: portal status is Connected\.$")
D=re.compile(r"^(\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}):\d+ \[Info \]: Tunnel is down due to disconnection\.$")

def read():
    r=sys.stdin.buffer.read(4)
    if not r: return None
    return json.loads(sys.stdin.buffer.read(struct.unpack("=I",r)[0]))

def send(o):
    e=json.dumps(o).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("=I",len(e))+e)
    sys.stdout.buffer.flush()

def info():
    if not os.path.isfile(LOG): return {"error":"log_not_found"}
    lc=ld=None
    try:
        with open(LOG) as f:
            for l in f:
                m=C.match(l)
                if m: lc=m.group(1)
                m=D.match(l)
                if m: ld=m.group(1)
    except PermissionError: return {"error":"permission_denied"}
    if not lc: return {"connected":False}
    ct=int(datetime.strptime(lc,"%m/%d/%Y %H:%M:%S").timestamp()*1000)
    if ld:
        dt=int(datetime.strptime(ld,"%m/%d/%Y %H:%M:%S").timestamp()*1000)
        if dt>ct: return {"connected":False,"lastDisconnect":dt}
    return {"connected":True,"sessionStart":ct}

msg=read()
send(info() if msg and msg.get("action")=="getVpnSession" else {"error":"unknown_action"})
PYEOF

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
echo "$SCRIPT" > "$HOST_SCRIPT"
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
