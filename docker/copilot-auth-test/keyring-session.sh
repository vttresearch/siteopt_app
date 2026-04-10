#!/usr/bin/env bash
set -euo pipefail

exec dbus-run-session -- bash -lc '
  set -euo pipefail
  eval "$(gnome-keyring-daemon --start --components=secrets)"
  export DBUS_SESSION_BUS_ADDRESS
  export GNOME_KEYRING_CONTROL
  export SSH_AUTH_SOCK
  echo "dbus: ${DBUS_SESSION_BUS_ADDRESS}"
  echo "keyring: ${GNOME_KEYRING_CONTROL}"
  if [ "$#" -eq 0 ]; then
    exec bash -il
  fi
  exec "$@"
' keyring-session "$@"