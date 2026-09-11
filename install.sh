#!/bin/sh
set -eu

# DESTDIR supports installation checks in an isolated filesystem tree.
root=${DESTDIR:-}
src=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
if [ -n "$root" ]; then
    case "$root" in /*) ;; *) echo 'DESTDIR must be absolute.' >&2; exit 1;; esac
    [ "$root" != / ] || { echo 'Use an empty DESTDIR for live installation.' >&2; exit 1; }
else
    [ "$(id -u)" = 0 ] || { echo 'Run as root on the router.' >&2; exit 1; }
    for cmd in iw ubus; do
        command -v "$cmd" >/dev/null || { echo "Missing dependency: $cmd" >&2; exit 1; }
    done
    for file in /usr/share/libubox/jshn.sh /etc/init.d/rpcd /www/luci-static/resources/luci.js; do
        [ -f "$file" ] || { echo "Missing dependency: $file" >&2; exit 1; }
    done
    [ -d /www/luci-static/resources/view ] || { echo 'Missing LuCI view directory.' >&2; exit 1; }
fi
for file in wifi-monitor wifi-monitor.js luci-app-wifi-monitor.json acl-wifi-monitor.json; do
    [ -s "$src/files/$file" ] || { echo "Missing source: $file" >&2; exit 1; }
done
sh -n "$src/files/wifi-monitor"
backup="$root/root/wifi-monitor-backups/$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$backup"
put() {
    source=$1
    target=$2
    mode=$3
    mkdir -p "$root$(dirname "$target")"
    if [ -e "$root$target" ]; then
        mkdir -p "$backup$(dirname "$target")"
        cp -p "$root$target" "$backup$target"
    fi
    cp "$src/files/$source" "$root$target"
    chmod "$mode" "$root$target"
}
put wifi-monitor /usr/libexec/rpcd/wifi-monitor 755
put wifi-monitor.js /www/luci-static/resources/view/wifi-monitor.js 644
put luci-app-wifi-monitor.json /usr/share/luci/menu.d/luci-app-wifi-monitor.json 644
put acl-wifi-monitor.json /usr/share/rpcd/acl.d/luci-app-wifi-monitor.json 644
if [ -z "$root" ]; then
    rm -f /tmp/luci-indexcache
    /etc/init.d/rpcd restart
    ready=false
    for attempt in 1 2 3 4 5; do
        if ubus -S list wifi-monitor 2>/dev/null | grep -qx 'wifi-monitor'; then
            ready=true
            break
        fi
        sleep 1
    done
    [ "$ready" = true ] || { echo 'Wi-Fi Monitor was copied, but rpcd did not register it.' >&2; exit 1; }
fi
printf 'Installed Wi-Fi Monitor. Backup: %s\n' "$backup"
echo 'Open LuCI: Services -> Wi-Fi monitor. Sign in again if necessary.'
