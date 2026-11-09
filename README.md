# openwrt

Source packages for OpenWrt 25.12 (apk) and the tooling that builds and publishes them as a signed apk repository.

## Packages

| Directory | Package(s) | What it is |
|---|---|---|
| `packages/kmod-amneziawg` | `kmod-amneziawg-r4ven-me` | AmneziaWG kernel module (built for the exact SDK kernel) |
| `packages/amneziawg-tools` | `amneziawg-tools-r4ven-me` | `awg` userspace tools and the netifd protocol helper |
| `packages/luci-proto-amneziawg` | `luci-proto-amneziawg-r4ven-me` | LuCI protocol support for `amneziawg` interfaces |
| `packages/luci-app-amneziawg` | `luci-app-amneziawg-r4ven-me` | LuCI peer management UI |
| `packages/luci-i18n-amneziawg-ru-r4ven-me` | `luci-i18n-amneziawg-ru-r4ven-me` | Russian translation for the AmneziaWG UI |
| `packages/luci-app-ocserv` | `luci-app-ocserv-r4ven-me` | LuCI UI for the OpenConnect VPN server (ocserv) |
| external `luci-theme-kornord` source | `luci-theme-kornord-r4ven-me` | Kornord LuCI theme |

Each directory is a regular OpenWrt package recipe, so the repo can also be used as a feed (`src-link r4ven /path/to/this/repo`).

## Connect the repository

On the router (OpenWrt 25.12, `x86_64`):

```sh
wget -O /etc/apk/keys/r4ven-apk.pub https://r4ven-me.github.io/openwrt/r4ven-apk.pub
echo https://r4ven-me.github.io/openwrt/25.12/x86_64/packages.adb > /etc/apk/repositories.d/r4ven.list
apk update
apk add luci-app-ocserv-r4ven-me
```

Updates then come with the usual `apk update && apk upgrade`. Everything is signed with the `r4ven-apk` key.
For AmneziaWG install `kmod-amneziawg-r4ven-me`, `amneziawg-tools-r4ven-me`, `luci-proto-amneziawg-r4ven-me`,
`luci-app-amneziawg-r4ven-me` (+ `luci-i18n-amneziawg-ru-r4ven-me`) and reboot once.
`kmod-amneziawg-r4ven-me` is built for the exact kernel of 25.12.6 x86/64 (6.12.112)
and will not load on another kernel build. More details: `build/gh-pages-README.md`.

## Layout

- `packages/` - package sources, one directory per package
- `build/` - Dockerfiles and scripts that build the packages in the OpenWrt SDK and publish the repo
- `tests/` - LuCI view render tests (`node tests/view-render.js`)
- `keys/` - public apk signing key (the private key lives only in KeePassXC)

## Make targets

- `make build` - build `luci-app-ocserv-r4ven-me` into `dist/`
- `make build-awg` - build the AmneziaWG packages and external Kornord theme into `dist-awg/`
- `make publish` - build the signed index into `repo-out/<RELEASE>/<ARCH>/`
- `make publish-push` - push `repo-out/` to the `gh-pages` branch
- `make clean` - remove built apks
