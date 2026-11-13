# Kornord for LuCI

The stock LuCI Bootstrap theme (same layout, top menu, mobile view) recolored with the [Nord](https://www.nordtheme.com) palette. Only CSS variables are overridden, in `htdocs/luci-static/kornord/kornord.css` (~2 KB).

Three entries appear in **System → System → Language and Style**:

- **Kornord** — follows the browser/OS `prefers-color-scheme`
- **KornordDark** — always dark
- **KornordLight** — always light

## Compatibility

Based on luci-theme-bootstrap from LuCI commit `75a306df84a020c57a631ef5b4c02ace56d93387` (OpenWrt 25.12). `cascade.css`, `mobile.css`, `menu-kornord.js`, `sysauth.js` and the `.ut` templates are upstream files with `bootstrap` renamed to `kornord`; the only functional change is one extra `<link>` for `kornord.css` in `header.ut`. For other LuCI versions, re-sync these files from upstream.

## Build

From an OpenWrt buildroot or SDK with the luci feed:

```sh
cp -a /path/to/kornord/luci-theme-kornord package/luci-theme-kornord
./scripts/feeds update luci && ./scripts/feeds install luci-base
make package/luci-theme-kornord/compile V=s
```

Install the resulting `.apk` (`apk add --allow-untrusted file.apk`) or `.ipk` (`opkg install`). The first installation selects Kornord; an upgrade keeps the current theme.

## Recovery over SSH

```sh
uci set luci.main.mediaurlbase='/luci-static/bootstrap'
uci commit luci
rm -f /tmp/luci-indexcache; rm -rf /tmp/luci-modulecache/*
/etc/init.d/uhttpd restart
```

## License

Apache-2.0 (LuCI upstream files and Kornord changes). See upstream LuCI copyright notices in the sources.
