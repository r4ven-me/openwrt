#!/bin/bash
# Runs inside the container: builds kmod-amneziawg, amneziawg-tools, luci-app-amneziawg and luci-proto-amneziawg into /out
set -euo pipefail
cd ~/sdk
rm -rf package/luci-app-amneziawg package/luci-proto-amneziawg
cp -r /src package/luci-app-amneziawg
cp -r /src-proto package/luci-proto-amneziawg
sed -i 's#\.\./\.\./luci\.mk#$(TOPDIR)/feeds/luci/luci.mk#' package/luci-app-amneziawg/Makefile
make defconfig
# drop the stub packages built into the image
find bin \( -name 'luci-app-amneziawg*' -o -name 'luci-proto-amneziawg*' -o -name 'luci-i18n-amneziawg*' \) | xargs -r rm -v
# The LuCI packages only copy files. Going through the top-level target (package/<name>/compile) would drag in
# their dependencies and repack every kernel module each time (~5 min per package); building in the package
# directory takes seconds. kmod-amneziawg and amneziawg-tools come from the image.
for p in luci-app-amneziawg luci-proto-amneziawg; do
	make -C "package/$p" TOPDIR="$HOME/sdk" compile V=s
done
find bin \( -name 'luci-app-amneziawg*' -o -name 'luci-proto-amneziawg*' -o -name 'luci-i18n-amneziawg*' -o -name 'kmod-amneziawg*' -o -name 'amneziawg-tools*' \) -name '*.apk' -exec cp -v {} /out/ \;
APK=~/sdk/staging_dir/host/bin/apk
mkdir -p /tmp/trusted && cp /keys/r4ven-apk.pub /tmp/trusted/
for f in /out/*.apk; do
	"$APK" adbsign --allow-untrusted --reset-signatures --sign-key /keys/r4ven-apk.pem "$f"
	"$APK" --keys-dir /tmp/trusted --no-network verify "$f"
done
