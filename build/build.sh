#!/bin/bash
# Runs inside the container: builds luci-app-ocserv from /src into /out
set -euo pipefail
cd ~/sdk
rm -rf package/luci-app-ocserv
cp -r /src package/luci-app-ocserv
sed -i 's#\.\./\.\./luci\.mk#$(TOPDIR)/feeds/luci/luci.mk#' package/luci-app-ocserv/Makefile
make defconfig
# drop the stub package built into the image
find bin -name 'luci-app-ocserv*' -delete
# Build in the package directory: the top-level package/<name>/compile target drags in dependencies and
# repacks every kernel module each time (~5 min); this takes seconds.
make -C package/luci-app-ocserv TOPDIR="$HOME/sdk" compile V=s
find bin -name 'luci-app-ocserv*' -exec cp -v {} /out/ \;
APK=~/sdk/staging_dir/host/bin/apk
mkdir -p /tmp/trusted && cp /keys/r4ven-apk.pub /tmp/trusted/
for f in /out/*.apk; do
	"$APK" adbsign --allow-untrusted --reset-signatures --sign-key /keys/r4ven-apk.pem "$f"
	"$APK" --keys-dir /tmp/trusted --no-network verify "$f"
done
