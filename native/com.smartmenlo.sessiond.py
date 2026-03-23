#!/usr/bin/env python3
"""Native messaging host for Smart Menlo Chrome extension.
Reads GlobalProtect VPN event log to determine session start time.
"""

import json
import struct
import sys
import os
import re
from datetime import datetime

LOG_PATH = "/Library/Logs/PaloAltoNetworks/GlobalProtect/pan_gp_event.log"
CONNECT_PATTERN = re.compile(
    r"^(\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}):\d+ \[Info \]: portal status is Connected\.$"
)
DISCONNECT_PATTERN = re.compile(
    r"^(\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}):\d+ \[Info \]: Tunnel is down due to disconnection\.$"
)


def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    length = struct.unpack("=I", raw_length)[0]
    data = sys.stdin.buffer.read(length)
    return json.loads(data)


def send_message(obj):
    encoded = json.dumps(obj).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("=I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def get_vpn_session_info():
    if not os.path.isfile(LOG_PATH):
        return {"error": "log_not_found"}

    last_connect = None
    last_disconnect = None

    try:
        with open(LOG_PATH, "r") as f:
            for line in f:
                m = CONNECT_PATTERN.match(line)
                if m:
                    last_connect = m.group(1)
                m = DISCONNECT_PATTERN.match(line)
                if m:
                    last_disconnect = m.group(1)
    except PermissionError:
        return {"error": "permission_denied"}

    if not last_connect:
        return {"connected": False}

    connect_ts = int(
        datetime.strptime(last_connect, "%m/%d/%Y %H:%M:%S").timestamp() * 1000
    )

    # If last disconnect is after last connect, VPN is currently down
    if last_disconnect:
        disconnect_ts = int(
            datetime.strptime(last_disconnect, "%m/%d/%Y %H:%M:%S").timestamp() * 1000
        )
        if disconnect_ts > connect_ts:
            return {"connected": False, "lastDisconnect": disconnect_ts}

    return {"connected": True, "sessionStart": connect_ts}


def main():
    msg = read_message()
    if msg and msg.get("action") == "getVpnSession":
        send_message(get_vpn_session_info())
    else:
        send_message({"error": "unknown_action"})


if __name__ == "__main__":
    main()
