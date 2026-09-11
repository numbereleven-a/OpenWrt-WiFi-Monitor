#!/bin/sh
set -eu
root=${DESTDIR:-}
if [ -n "$root" ]; then
    case "$root" in /*) ;; *) echo 'DESTDIR must be absolute.' >&2; exit 1;; esac
    [ "$root" != / ] || { echo 'Use an empty DESTDIR for live removal.' >&2; exit 1; }
else
    [ "$(id -u)" = 0 ] || { echo 'Run as root on the router.' >&2; exit 1; }
fi
rm -f "$root/usr/libexec/rpcd/wifi-monitor" \
    "$root/www/luci-static/resources/view/wifi-monitor.js" \
    "$root/usr/share/luci/menu.d/luci-app-wifi-monitor.json" \
    "$root/usr/share/rpcd/acl.d/luci-app-wifi-monitor.json"
if [ -z "$root" ]; then
    rm -f /tmp/luci-indexcache
    /etc/init.d/rpcd restart
fi
echo 'Removed Wi-Fi Monitor. Backups and the original CLI script were preserved.'
