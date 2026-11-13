#!/bin/bash
# Builds the suffixed AmneziaWG packages and Kornord theme into /out.
set -euo pipefail
cd ~/sdk
rm -f /out/*.apk
rm -rf package/luci-app-amneziawg package/luci-proto-amneziawg package/luci-i18n-amneziawg-ru-r4ven-me package/luci-theme-kornord
cp -r /src package/luci-app-amneziawg
cp -r /src-proto package/luci-proto-amneziawg
cp -r /src-i18n package/luci-i18n-amneziawg-ru-r4ven-me
cp -r /src-theme package/luci-theme-kornord
sed -i 's#\.\./\.\./luci\.mk#$(TOPDIR)/feeds/luci/luci.mk#' package/luci-app-amneziawg/Makefile
sed -i '/include $(TOPDIR)\/rules.mk/a PKG_NAME:=luci-theme-kornord-r4ven-me\nPKG_PROVIDES:=luci-theme-kornord' package/luci-theme-kornord/Makefile
sed -i 's/Package\/luci-theme-kornord\/postrm/Package\/luci-theme-kornord-r4ven-me\/postrm/' package/luci-theme-kornord/Makefile
make defconfig
# drop the stub packages built into the image
find bin \( -name 'luci-app-amneziawg-r4ven-me*.apk' -o -name 'luci-proto-amneziawg-r4ven-me*.apk' -o -name 'luci-i18n-amneziawg-ru-r4ven-me*.apk' -o -name 'luci-theme-kornord-r4ven-me*.apk' \) | xargs -r rm -v
# The LuCI packages only copy files. Going through the top-level target (package/<name>/compile) would drag in
# their dependencies and repack every kernel module each time (~5 min per package); building in the package
# directory takes seconds. kmod-amneziawg and amneziawg-tools come from the image.
for p in luci-app-amneziawg luci-proto-amneziawg luci-i18n-amneziawg-ru-r4ven-me luci-theme-kornord; do
	make -C "package/$p" TOPDIR="$HOME/sdk" compile V=s
done
find bin -name '*-r4ven-me*.apk' -exec cp -v {} /out/ \;
# Signing is optional: CI builds without the key (it lives only in KeePassXC) and the apks are signed
# afterwards by `make release` (build/sign.sh).
if [ -f /keys/r4ven-apk.pem ]; then
	APK=~/sdk/staging_dir/host/bin/apk
	mkdir -p /tmp/trusted && cp /keys/r4ven-apk.pub /tmp/trusted/
	for f in /out/*.apk; do
		"$APK" adbsign --allow-untrusted --reset-signatures --sign-key /keys/r4ven-apk.pem "$f"
		"$APK" --keys-dir /tmp/trusted --no-network verify "$f"
	done
fi
