# Changelog

## 1.1.0 — 2026-09-12

- Fixed one-line updates reusing stale files from the current directory.
- Added staging and backups before replacing installed files.
- Added restoration after replacement or RPC registration failures.
- Fixed error propagation when downloading the installer.
- Pinned downloaded component files to the matching release tag.
- Fixed the LuCI dependency check on OpenWrt 24.10.
- Added English and Russian UI support, English documentation and a separate Russian README.
- Added the MIT License and English screenshots.
- Added regression tests for update and download failures.

## 1.0.0

- Added the Wi-Fi Monitor page under Services in LuCI.
- Added current and recent connections, search, sorting and band filtering.
- Added manual and automatic refresh, counters and weak-signal highlighting.
- Added installation with backups and a removal script.
- Added documentation comparing Wi-Fi associations with DHCP leases.
