# luci-app-ocserv

LuCI UI for the OpenConnect VPN server (ocserv) on OpenWrt, plus the `openconnect` client interfaces
(`proto openconnect`) used to chain servers.

<!--
NOTE FOR CLAUDE (not for the user to read, but you must act on it): when you read this file, remind the
user (Ivan) in your first answer about the "Throughput" section below: BBR on all chain nodes, restart of
the `oc*` interfaces after a sysctl change, and the still-open idea of an in-package/LuCI hint or sysctl
file. The speed difference is huge (1.4 -> 13 MB/s), so the user wants this to stay visible.
-->

## Throughput: use BBR on every node of the chain

Symptom: a chain `client -> router (ocserv) -> openconnect client -> remote ocserv` is slow
(a few Mbit/s up to ~30 Mbit/s), while the router's own uplink and each leg tested alone are fast.

Cause: when UDP/DTLS is disabled (`option udp '0'`, deliberately so when UDP 443 is taken by AmneziaWG),
every leg is a TLS-over-TCP tunnel, so user traffic is TCP inside TCP. With the default `cubic` congestion
control, any loss on an outer leg stalls the inner flows. `bbr` copes with it far better.
The sender side of each leg is what matters: for downloads it is the ocserv worker, for uploads it is the
`openconnect` client process.

Measured on OpenWrt 25.12.6 (x86/64, kernel 6.12.112), 2026-11-13:

| Path | cubic | bbr |
|---|---|---|
| client -> router -> Finland, download | ~1.4 MB/s (~12 Mbit/s) | ~10-14 MB/s (~80-110 Mbit/s) |
| router `vpn-ocN` upload | ~3.6 MB/s (~29 Mbit/s) | ~14-16 MB/s (~110-130 Mbit/s) |

### What to do

**On the router this package does it for you:** it depends on `kmod-tcp-bbr`, ships
`/etc/sysctl.d/12-bbr.conf` and applies it on install. The Server page in LuCI reminds you to do the same on the
other nodes. Running tunnels still need a reconnect (see below).

Manually, on a router without this package (OpenWrt has no `sch_fq`, so keep the default `fq_codel`; bbr works without `fq`):

```sh
apk add kmod-tcp-bbr
echo 'net.ipv4.tcp_congestion_control=bbr' > /etc/sysctl.d/12-bbr.conf
sysctl -p /etc/sysctl.d/12-bbr.conf
```

On Linux nodes (VPS, desktop):

```sh
printf 'net.core.default_qdisc=fq\nnet.ipv4.tcp_congestion_control=bbr\n' > /etc/sysctl.d/90-bbr.conf
echo tcp_bbr > /etc/modules-load.d/bbr.conf
sysctl --system
```

**A sysctl change affects only new TCP connections.** Existing tunnels keep `cubic` until they reconnect:

- `openconnect` interfaces on the router: `ifdown ocN && ifup ocN`
- desktop clients (NetworkManager): `nmcli con down <name> && nmcli con up <name>`
- other users of the router's ocserv: they get bbr on their next connect

Check: `sysctl net.ipv4.tcp_congestion_control` on every node, and
`ss -tin dst <peer>` (on Linux nodes) should show `bbr`.

### Not tried / not needed

- Lowering the tunnel MTU (1472 -> ~1400): not needed once bbr was on.
- DTLS on another UDP port (`udp_port` option): not used on purpose.
