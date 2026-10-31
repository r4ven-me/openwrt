# r4ven-me OpenWrt apk repository

Packages for OpenWrt 25.12 (apk), architecture `x86_64`:

- `luci-app-ocserv`
- `kmod-amneziawg`, `amneziawg-tools`, `luci-proto-amneziawg`, `luci-app-amneziawg`, `luci-i18n-amneziawg-ru`

Everything is signed with the `r4ven-apk` key.

## Connect

```sh
wget -O /etc/apk/keys/r4ven-apk.pub https://r4ven-me.github.io/openwrt/r4ven-apk.pub
echo https://r4ven-me.github.io/openwrt/25.12/x86_64/packages.adb > /etc/apk/repositories.d/r4ven.list
apk update
apk add luci-app-ocserv
```

Updates then come with the usual `apk update && apk upgrade`.

## AmneziaWG notes

`kmod-amneziawg` is built for the exact kernel of OpenWrt 25.12.6 x86/64 (6.12.112) and will not load on another kernel build.
Install `kmod-amneziawg`, `amneziawg-tools`, `luci-app-amneziawg` (+ `luci-i18n-amneziawg-ru`), then reboot once:
netifd only learns the `amneziawg` protocol at start-up.
