#!/bin/sh
set -eu
src=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
work=$(mktemp -d)
# The temporary tree is intentionally retained for inspection.
DESTDIR="$work" sh "$src/install.sh"
for target in usr/libexec/rpcd/wifi-monitor www/luci-static/resources/view/wifi-monitor.js usr/share/luci/menu.d/luci-app-wifi-monitor.json usr/share/rpcd/acl.d/luci-app-wifi-monitor.json; do
    test -s "$work/$target"
done
test -x "$work/usr/libexec/rpcd/wifi-monitor"
mkdir -p "$work/usr/bin"
echo original-cli > "$work/usr/bin/wifi_monitor"
echo previous-version > "$work/usr/libexec/rpcd/wifi-monitor"
DESTDIR="$work" sh "$src/install.sh"
find "$work/root/wifi-monitor-backups" -type f -name wifi-monitor -exec cat '{}' \; | grep -q previous-version
DESTDIR="$work" sh "$src/uninstall.sh"
test ! -e "$work/usr/libexec/rpcd/wifi-monitor"
test ! -e "$work/www/luci-static/resources/view/wifi-monitor.js"
test ! -e "$work/usr/share/luci/menu.d/luci-app-wifi-monitor.json"
test ! -e "$work/usr/share/rpcd/acl.d/luci-app-wifi-monitor.json"
grep -q original-cli "$work/usr/bin/wifi_monitor"
echo "PASS: installation, update backup, removal, original CLI preserved. Test tree: $work"
