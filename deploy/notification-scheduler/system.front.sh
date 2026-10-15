#!/bin/sh
set -eu
minute=$(( $(date -u +%s) / 60 ))
exec /usr/bin/python3 /usr/local/libexec/doctor-site-notifications-v1/guard.py dispatch system notifications-v1 "$minute"
