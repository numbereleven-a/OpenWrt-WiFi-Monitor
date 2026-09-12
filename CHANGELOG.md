# Changelog

## 1.1.0 — 2026-09-12

- Fixed one-line updates silently installing outdated files from the current directory.
- Fixed failed updates leaving a mixture of old and new files by preparing replacements and restoring previous files on failure.
- Fixed installer download failures incorrectly returning a successful exit status.

## 1.0.0

- Added the Wi-Fi Monitor page under Services in LuCI.
- Added current and recent connections, search, sorting and band filtering.
- Added manual and automatic refresh, counters and weak-signal highlighting.
- Added installation with backups and a removal script.
- Added documentation comparing Wi-Fi associations with DHCP leases.
