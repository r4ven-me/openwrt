# openwrt

Source packages for OpenWrt 25.12 (apk) and the tooling that builds and publishes them as a signed apk repository.

## Packages

| Directory | Package(s) | What it is |
|---|---|---|
| `packages/kmod-amneziawg` | `kmod-amneziawg` | AmneziaWG kernel module (built for the exact SDK kernel) |
| `packages/amneziawg-tools` | `amneziawg-tools` | `awg` userspace tools and the netifd protocol helper |
| `packages/luci-proto-amneziawg` | `luci-proto-amneziawg` | LuCI protocol support for `amneziawg` interfaces |
| `packages/luci-app-amneziawg` | `luci-app-amneziawg`, `luci-i18n-amneziawg-ru` | LuCI peer management UI |
| `packages/luci-app-ocserv` | `luci-app-ocserv` | LuCI UI for the OpenConnect VPN server (ocserv) |

Each directory is a regular OpenWrt package recipe, so the repo can also be used as a feed (`src-link r4ven /path/to/this/repo`).

## Layout

- `packages/` - package sources, one directory per package
- `build/` - Dockerfiles and scripts that build the packages in the OpenWrt SDK and publish the repo
- `tests/` - LuCI view render tests (`node tests/view-render.js`)
- `keys/` - public apk signing key (the private key lives only in KeePassXC)

## Make targets

- `make build` - build `luci-app-ocserv` into `dist/`
- `make build-awg` - build the AmneziaWG packages into `dist-awg/`
- `make publish` - build the signed index into `repo-out/<RELEASE>/<ARCH>/`
- `make publish-push` - push `repo-out/` to the `gh-pages` branch
- `make clean` - remove built apks

Using the published repository on a router: see `build/gh-pages-README.md`.
