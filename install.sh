#!/bin/sh
set -eu

version=1.1.0
source_ref=v1.1.0
root=${DESTDIR:-}
mode=${1:-auto}
case "$mode" in auto|--download) ;; *) echo 'Usage: sh install.sh [--download]' >&2; exit 1;; esac

# DESTDIR supports installation checks in an isolated filesystem tree.
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

paths='/usr/libexec/rpcd/wifi-monitor
/www/luci-static/resources/view/wifi-monitor.js
/usr/share/luci/menu.d/luci-app-wifi-monitor.json
/usr/share/rpcd/acl.d/luci-app-wifi-monitor.json'
download_dir=''
backup=''
transaction=false
restart_attempted=false

refresh_rpc() {
    rm -f /tmp/luci-indexcache
    /etc/init.d/rpcd restart || return 1
    for attempt in 1 2 3 4 5; do
        if ubus -S list wifi-monitor 2>/dev/null | grep -qx 'wifi-monitor'; then return 0; fi
        sleep 1
    done
    return 1
}

finish() {
    result=$?
    trap - EXIT HUP INT TERM
    if [ "$transaction" = true ]; then
        echo 'Installation failed; restoring the previous files.' >&2
        rollback_failed=false
        for target in $paths; do
            # Only destinations whose replacement was attempted need restoring.
            [ -f "$backup/changed$target" ] || continue
            if [ -f "$backup/original$target" ]; then
                if ! cp -p "$backup/original$target" "$root$target"; then rollback_failed=true; fi
            elif ! rm -f "$root$target"; then rollback_failed=true
            fi
        done
        if [ "$restart_attempted" = true ]; then
            if ! /etc/init.d/rpcd restart; then rollback_failed=true; fi
        fi
        if [ "$rollback_failed" = true ]; then
            echo "Automatic restoration was incomplete. Restore files from: $backup/original" >&2
        else
            echo 'Previous files restored.' >&2
        fi
        [ "$result" -ne 0 ] || result=1
    fi
    if [ -n "$backup" ]; then
        for target in $paths; do
            rm -f "$root$target.wifi-monitor-$$" || true
            rm -f "$backup/changed$target" || true
        done
    fi
    if [ -n "$download_dir" ]; then
        for name in wifi-monitor wifi-monitor.js luci-app-wifi-monitor.json acl-wifi-monitor.json; do
            rm -f "$download_dir/files/$name" || true
        done
        rmdir "$download_dir/files" "$download_dir" 2>/dev/null || true
    fi
    exit "$result"
}
trap finish EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

src=''
# A shell reading stdin has no installation directory. Never use its cwd.
if [ "$mode" = auto ]; then
    case "$0" in
        sh|ash|dash|bash|*/sh|*/ash|*/dash|*/bash|-*) ;;
        *)
            if [ -f "$0" ]; then
                candidate=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
                if [ -f "$candidate/VERSION" ] && [ "$(cat "$candidate/VERSION")" = "$version" ]; then
                    src=$candidate
                fi
            fi
            ;;
    esac
fi
if [ -z "$src" ]; then
    command -v wget >/dev/null || { echo 'Missing dependency: wget' >&2; exit 1; }
    download_dir=$(mktemp -d /tmp/wifi-monitor.XXXXXX)
    mkdir -p "$download_dir/files"
    base="https://raw.githubusercontent.com/numbereleven-a/OpenWrt-WiFi-Monitor/$source_ref/files"
    for name in wifi-monitor wifi-monitor.js luci-app-wifi-monitor.json acl-wifi-monitor.json; do
        wget -O "$download_dir/files/$name" "$base/$name" || { echo "Failed to download: $name" >&2; exit 1; }
    done
    src=$download_dir
fi
for name in wifi-monitor wifi-monitor.js luci-app-wifi-monitor.json acl-wifi-monitor.json; do
    [ -s "$src/files/$name" ] || { echo "Missing source: $name" >&2; exit 1; }
done
sh -n "$src/files/wifi-monitor"
backup="$root/root/wifi-monitor-backups/$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$backup"

# Back up every destination and stage all replacements on their destination
# filesystems before changing any installed file.
for target in $paths; do
    name=${target##*/}
    case "$target" in */acl.d/*) name=acl-wifi-monitor.json;; esac
    mkdir -p "$root$(dirname "$target")" "$backup/original$(dirname "$target")" "$backup/changed$(dirname "$target")"
    if [ -e "$root$target" ]; then
        [ -f "$root$target" ] || { echo "Destination is not a file: $target" >&2; exit 1; }
        cp -p "$root$target" "$backup/original$target"
    fi
    cp "$src/files/$name" "$root$target.wifi-monitor-$$"
    case "$target" in /usr/libexec/rpcd/*) mode=755;; *) mode=644;; esac
    chmod "$mode" "$root$target.wifi-monitor-$$"
done
transaction=true
for target in $paths; do
    : > "$backup/changed$target"
    mv -f "$root$target.wifi-monitor-$$" "$root$target"
done
if [ -z "$root" ]; then
    restart_attempted=true
    refresh_rpc || { echo 'RPC registration failed.' >&2; exit 1; }
fi
transaction=false
printf 'Installed Wi-Fi Monitor %s. Backup: %s/original\n' "$version" "$backup"
echo 'Open LuCI: Services -> Wi-Fi Monitor. Sign in again if necessary.'
