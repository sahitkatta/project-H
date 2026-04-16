#!/bin/sh
set -e
cd /app
python seed.py
exec supervisord -n -c /etc/supervisord.conf
