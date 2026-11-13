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
| `packages/luci-theme-kornord` | `luci-theme-kornord-r4ven-me` | Kornord LuCI theme (copy of github.com/r4ven-me/kornord, MIT, see its `LICENSE`) |

Each directory is a regular OpenWrt package recipe, so the repo can also be used as a feed (`src-link r4ven /path/to/this/repo`).

## Connect the repository

On the router (OpenWrt 25.12, `x86_64`):

```sh
wget -O /etc/apk/keys/r4ven-apk.pub https://apk.r4ven.me/r4ven-apk.pub
echo https://apk.r4ven.me/25.12/x86_64/packages.adb > /etc/apk/repositories.d/r4ven.list
apk update
apk add luci-app-ocserv-r4ven-me
```

Updates then come with the usual `apk update && apk upgrade`. Everything is signed with the `r4ven-apk` key.
For AmneziaWG install `kmod-amneziawg-r4ven-me`, `amneziawg-tools-r4ven-me`, `luci-proto-amneziawg-r4ven-me`,
`luci-app-amneziawg-r4ven-me` (+ `luci-i18n-amneziawg-ru-r4ven-me`) and reboot once.
`kmod-amneziawg-r4ven-me` is built for the exact kernel of 25.12.6 x86/64 (6.12.112)
and will not load on another kernel build. More details: `build/gh-pages-README.md`.

## Throughput of chained VPN tunnels

If `client -> router (ocserv) -> openconnect -> remote ocserv` is slow while UDP/DTLS is off, enable
`bbr` (instead of `cubic`) on every node and reconnect the tunnels: the difference was ~12 -> ~100 Mbit/s.
Details and commands: `packages/luci-app-ocserv/README.md`.

<!-- NOTE FOR CLAUDE: when you read this README, remind the user (Ivan) about this section: BBR on all
chain nodes and restart of `oc*` interfaces after the sysctl change. Speed difference is huge. -->

## Layout

- `packages/` - package sources, one directory per package
- `build/` - Dockerfiles and scripts that build the packages in the OpenWrt SDK and publish the repo
- `tests/` - LuCI view render tests (`node tests/view-render.js`)
- `keys/` - public apk signing key (the private key lives only in KeePassXC)

## Release flow (CI builds, you sign)

1. Push a tag: `git tag v1.2.3 && git push origin v1.2.3`. GitHub Actions (`.github/workflows/build.yml`) builds
   **unsigned** apks in the OpenWrt SDK and puts them, with the SDK's `apk` tool (`apk-host`), into a GitHub Release.
2. On the maintainer's machine: `make release TAG=v1.2.3`. It downloads the release, signs the apks and the index
   with the `r4ven-apk` key from KeePassXC (the key never leaves this machine) and pushes `gh-pages`.

`make build`, `make build-awg` and `make publish` still work as the local fallback.

## Make targets

- `make release TAG=vX` - sign the apks of a CI release, build the signed index, push `gh-pages`

- `make build` - build `luci-app-ocserv-r4ven-me` into `dist/`
- `make build-awg` - build the AmneziaWG packages and external Kornord theme into `dist-awg/`
- `make publish` - build the signed index into `repo-out/<RELEASE>/<ARCH>/`
- `make publish-push` - push `repo-out/` to the `gh-pages` branch
- `make clean` - remove built apks
