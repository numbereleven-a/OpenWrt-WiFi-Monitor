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

# Mock only network and selected filesystem failures. All actual installer
# operations still run in temporary DESTDIR trees with the original script.
export WM_TEST_SOURCE="$src"
export WM_TEST_LOG="$work/downloads.log"
export WM_TEST_FAULT=''
mkdir -p "$work/mock-bin"
for cmd in wget cp mv; do
    cp "$src/tests/mocks/$cmd" "$work/mock-bin/$cmd"
    chmod 755 "$work/mock-bin/$cmd"
done
PATH="$work/mock-bin:$PATH"
export PATH
paths='usr/libexec/rpcd/wifi-monitor
www/luci-static/resources/view/wifi-monitor.js
usr/share/luci/menu.d/luci-app-wifi-monitor.json
usr/share/rpcd/acl.d/luci-app-wifi-monitor.json'

assert_previous() {
    for target in $paths; do grep -qx previous-version "$1/$target"; done
    test -z "$(find "$1" -type f -name '*.wifi-monitor-*' -print)"
}

for fault in stage-copy promote; do
    test_root="$work/$fault"
    for target in $paths; do
        mkdir -p "$test_root/$(dirname "$target")"
        echo previous-version > "$test_root/$target"
    done
    WM_TEST_FAULT=$fault
    export WM_TEST_FAULT
    if DESTDIR="$test_root" sh "$src/install.sh"; then
        echo "Expected $fault failure" >&2; exit 1
    fi
    assert_previous "$test_root"
    echo "PASS: previous files preserved after $fault failure"
done

WM_TEST_FAULT=promote
if DESTDIR="$work/failed-first-install" sh "$src/install.sh"; then exit 1; fi
for target in $paths; do test ! -e "$work/failed-first-install/$target"; done
echo 'PASS: failed first installation removed newly installed files'

WM_TEST_FAULT=''
mkdir -p "$work/old/files"
for name in wifi-monitor wifi-monitor.js luci-app-wifi-monitor.json acl-wifi-monitor.json; do
    echo previous-version > "$work/old/files/$name"
done
(
    cd "$work/old"
    cat "$src/install.sh" | DESTDIR="$work/stdin-root" sh
)
cmp "$src/files/wifi-monitor" "$work/stdin-root/usr/libexec/rpcd/wifi-monitor"
test "$(wc -l < "$WM_TEST_LOG")" -eq 4
test "$(grep -c '/v1.1.0/files/' "$WM_TEST_LOG")" -eq 4
echo 'PASS: stdin installation ignored stale cwd and downloaded one release'

# Execute the documented command verbatim to check its exit status.
one_line=$(sed -n '/^(wm_installer=/p' "$src/README.md")
test -n "$one_line"
test "$one_line" = "$(sed -n '/^(wm_installer=/p' "$src/README.ru.md")"
WM_TEST_FAULT=download-installer
if DESTDIR="$work/network-failure" sh -c "$one_line"; then
    echo 'Download failure returned success' >&2; exit 1
fi
test ! -e "$work/network-failure/usr/libexec/rpcd/wifi-monitor"
echo 'PASS: failed installer download returned a nonzero status'

WM_TEST_FAULT=download-payload
if DESTDIR="$work/payload-failure" sh -c "$one_line"; then exit 1; fi
test ! -e "$work/payload-failure/usr/libexec/rpcd/wifi-monitor"
echo 'PASS: failed payload download did not modify the installation'

WM_TEST_FAULT=''
(
    cd "$work/old"
    DESTDIR="$work/oneline-root" sh -c "$one_line"
)
cmp "$src/files/wifi-monitor" "$work/oneline-root/usr/libexec/rpcd/wifi-monitor"
echo 'PASS: documented one-line installation succeeded from a stale checkout'
