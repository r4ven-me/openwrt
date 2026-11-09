# kmod-amneziawg and amneziawg-tools

Package recipes for `kmod-amneziawg` (this directory) and `amneziawg-tools` (`../amneziawg-tools`) (AmneziaWG 2.0, sources pinned by tag
to the upstream amnezia-vpn repositories). Taken from github.com/Slava-Shchipunov/awg-openwrt
(rev 03b6226); the netifd helper `amneziawg.sh` derives from amnezia-vpn/amneziawg-openwrt (Apache-2.0).

## Install order / notes
Install `kmod-amneziawg-r4ven-me`, `amneziawg-tools-r4ven-me`, `luci-app-amneziawg-r4ven-me`
(+ `luci-i18n-amneziawg-ru-r4ven-me`), then reboot once.
netifd only learns the `amneziawg` protocol at start-up. `kmod-amneziawg-r4ven-me` is built for the exact kernel
of the SDK (25.12.6 x86/64, 6.12.112); it will not load on another kernel build.
Build: `make build-awg` -> `dist-awg/*.apk`, signed with the `r4ven-apk` key (private part is in KeePassXC, public: `keys/r4ven-apk.pub`).
