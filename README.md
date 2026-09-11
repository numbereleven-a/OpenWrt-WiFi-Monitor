# OpenWrt Wi-Fi Monitor

**English** | [Русский](README.ru.md)

**See who is connected to Wi-Fi right now, for how long, and with what signal strength — on one LuCI page.**

Wi-Fi Monitor adds **Services → Wi-Fi Monitor** to LuCI. It reads the stations currently reported by the wireless interfaces, enriches them with names and IPv4 addresses from DHCP leases, and presents a searchable overview plus a list of the most recently connected stations. The page follows the LuCI language and supports both English and Russian.

[Installation](#installation) · [Features](#features) · [Why DHCP leases are not enough](#why-dhcp-leases-are-not-enough) · [Limitations](#limitations)

![Wi-Fi Monitor overview with counters, search, band filters and connected stations](docs/images/overview.png)

*Device names, SSIDs, IP addresses and MAC addresses in the screenshots are fictional. The overview image contains only part of the table; its counter covers all connections.*

## Why DHCP leases are not enough

A DHCP lease answers **“which address was assigned to this device, and for how long is the lease valid?”** It does not prove that the device is currently associated with Wi-Fi. A phone may have left the network while its lease remains active, and the lease table can also contain wired clients.

Wi-Fi Monitor answers **“which stations does the Wi-Fi driver see now, and what does each connection look like?”** The station list comes from `iw ... station dump`; DHCP is used only to map a MAC address to an IPv4 address and hostname.

| Information | DHCP leases | Wi-Fi Monitor |
| --- | --- | --- |
| Assigned IP address and hostname | Yes | Yes, when a local DHCP lease exists |
| Remaining lease time | Yes | Not displayed |
| Current Wi-Fi association | A lease does not guarantee it | Reported by the Wi-Fi driver |
| Duration of the current association | Lease time is different | Displayed as time online |
| Most recently connected stations | Cannot be determined reliably | Dedicated list ordered by connection time |
| Band, SSID and signal | Not in the lease table | Displayed for every station |
| RX/TX link rates | Not in the lease table | Displayed when reported by the driver |
| Client with a manually configured IP | May be absent | Association and MAC are visible; IP may be unknown |

### How is it more convenient than the standard Wi-Fi status?

LuCI already provides an **Associated Stations** table with connected clients, signal information and RX/TX link rates. Wi-Fi Monitor adds tools intended for quick, repeated checks:

- **Connection duration and recent connections** show which station has just joined or reconnected.
- **Search and sorting** find a client by hostname, IP, MAC or SSID and order the table by signal or time online.
- **Band filtering** separates 2.4, 5 and 6 GHz stations.
- **Summary cards** show the total number of stations, counts by band and the number with weak signal.
- **Controlled refresh** provides a single snapshot on demand or optional refresh every 10, 30 or 60 seconds.

For example, after connecting a new phone, open “Recently connected” instead of scanning the full status page. When a camera behaves inconsistently, search by its hostname and check its signal and current connection duration. The monitor does not diagnose the cause of a disconnection, but makes the relevant symptoms easier to spot.

## Features

- English and Russian interface selected automatically from the LuCI language.
- Hostname, IPv4, MAC, band, SSID, signal in dBm, connection duration and RX/TX link rates.
- Sorting by column; click a heading again to reverse the direction.
- Search by hostname, IP, MAC, SSID or interface name.
- Band filter shared by both tables; summary cards continue to describe the complete snapshot.
- 10, 20 or all recent current connections, newest first.
- Manual refresh and optional automatic refresh. Automatic refresh is off by default and pauses while the browser tab is hidden.
- Previous data remains visible if an update fails, together with an error message.
- Data is collected only when requested. There is no background daemon and no connection history written to flash storage.

## Recently connected

![Recently connected stations with connection time, name, IP, MAC, band and time online](docs/images/recent-connections.png)

This is **not a persistent event log**. It contains only stations that are still connected when the page is refreshed. A station disappears from both tables after disconnecting. The connection timestamp is calculated from the router clock and association duration, then displayed in the browser time zone.

## Compatibility

The project was tested on **OpenWrt 24.10.1 with LuCI and the mac80211 driver on MediaTek Filogic**. Other OpenWrt versions and wireless drivers may require testing, and some fields may be unavailable.

Required components are LuCI, `rpcd`, `ubus`, the `iw` command and `/usr/share/libubox/jshn.sh` from the `jshn` package. Most are already present in a standard LuCI installation. The installer checks the required commands and files before copying anything.

The intended setup is a router or access point where `iw` reports associated Wi-Fi stations. Hostnames and IPv4 addresses are read from `/tmp/dhcp.leases`. If DHCP runs on another device, associations are still shown, but names and addresses may be missing.

## Installation

Connect to the router over SSH as root, then download and install the source:

```sh
mkdir -p /tmp/wifi-monitor-install
cd /tmp/wifi-monitor-install
wget -O source.tar.gz https://github.com/numbereleven-a/OpenWrt-WiFi-Monitor/archive/refs/heads/main.tar.gz
tar -xzf source.tar.gz
cd OpenWrt-WiFi-Monitor-main
sh install.sh
```

Open **Services → Wi-Fi Monitor**. The direct path relative to the router address is `/cgi-bin/luci/admin/services/wifi-monitor`.

If the menu item does not appear, sign out of LuCI and sign in again. If the browser shows an older page, force-refresh it.

The installer copies four files and restarts `rpcd` to register the data method. The current LuCI session may require a new sign-in. **The router and Wi-Fi are not rebooted or restarted.** Wireless and DHCP settings are not changed. An existing `/usr/bin/wifi_monitor` command remains untouched; the web interface does not depend on it.

| File | Purpose |
| --- | --- |
| `/usr/libexec/rpcd/wifi-monitor` | Data collection and the `status` RPC method |
| `/www/luci-static/resources/view/wifi-monitor.js` | LuCI page |
| `/usr/share/luci/menu.d/luci-app-wifi-monitor.json` | Menu entry |
| `/usr/share/rpcd/acl.d/luci-app-wifi-monitor.json` | Read access to the data through LuCI |

### Updating and removing

To update, download the latest source and run `sh install.sh` again. Replaced files are copied to a timestamped directory under `/root/wifi-monitor-backups/`. The backup directory can be empty on the first installation.

To remove the component from the source directory:

```sh
sh uninstall.sh
```

Only the four component files are removed and RPC registration is refreshed. Backups and the original command-line script are preserved. A firmware upgrade may require reinstalling the component because this is a file-based installation rather than an `opkg` package.

## Limitations

- **Online means the duration of the current Wi-Fi association**, not DHCP lease time or device uptime. It starts again after reconnection.
- **RX/TX values are radio link rates**, not an internet speed test or actual traffic. RX is reception by the router from the client; TX is transmission from the router to the client.
- **Signal uses `signal avg`**, falling back to `signal`. Green is −60 dBm or better, amber is −70 to below −60 dBm, and red is below −70 dBm. These are viewing aids rather than a universal quality rating.
- **Hostnames and IP addresses are hints from local DHCP leases.** IPv6, DNS name resolution and reliable discovery of static addresses are not implemented. MAC randomization may make the same client appear as another device.
- **Counters describe association records.** A client represented by more than one interface or association can be counted more than once.
- **Only interfaces on this router are visible.** Other access points are not discovered automatically. The UI recognizes 6 GHz, but that band has not been tested on the reference setup and has no separate summary card.
- **Interfaces are read sequentially.** A station joining or leaving during collection can cause a brief mismatch; the next snapshot will correct it.

## Verification

On the router:

```sh
ubus call wifi-monitor status
```

The response should contain `timestamp`, a `devices` array and a `warning` string. An empty array is valid when no Wi-Fi stations are connected. A non-empty `warning` lists interfaces that could not be read.

On a computer with Node.js:

```sh
node --check files/wifi-monitor.js
node tests/view.cjs
```

The UI tests use fictional data and a lightweight DOM model. They cover English and Russian rendering, search, filtering, sorting, refresh and error handling. They do not replace a full browser test.

Installation, update backup and removal can be checked on OpenWrt or Linux with `sh tests/install.sh`. It installs into a separate temporary tree through `DESTDIR`, does not restart services and retains the test directory for inspection.

## How it works

```text
LuCI page → ubus / rpcd → iw: currently associated Wi-Fi stations
                       → DHCP: hostname and IPv4 lookup by MAC
```

Each request produces one snapshot used for both tables and all counters. Search, filtering and sorting run in the browser and execute no additional commands on the router.

OpenWrt references: [listing connected clients](https://openwrt.org/faq/how_to_get_a_list_of_connected_clients), [DHCP and DNS configuration](https://openwrt.org/docs/guide-user/base-system/dhcp), and the [standard LuCI station table source](https://github.com/openwrt/luci/blob/openwrt-24.10/modules/luci-mod-status/htdocs/luci-static/resources/view/status/include/60_wifi.js).

## License

Released under the [MIT License](LICENSE).
