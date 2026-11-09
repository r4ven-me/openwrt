#!/bin/bash
# Runs inside the container: picks the latest .apk per package from /dist and /dist-awg and writes a signed repo into /out
set -euo pipefail
APK=~/sdk/staging_dir/host/bin/apk
mkdir -p /out
rm -f /out/*.apk /out/packages.adb
declare -A latest
for f in /dist/*-r4ven-me-*.apk /dist-awg/*-r4ven-me-*.apk; do
	[ -e "$f" ] || continue
	name=$(basename "$f" | sed 's/-[0-9].*//')
	cur=${latest[$name]:-}
	if [ -z "$cur" ] || [ "$(printf '%s\n%s\n' "$(basename "$cur")" "$(basename "$f")" | sort -V | tail -1)" = "$(basename "$f")" ]; then
		latest[$name]=$f
	fi
done
for name in "${!latest[@]}"; do
	cp -v "${latest[$name]}" /out/
done
cd /out
"$APK" mkndx --allow-untrusted --output packages.adb ./*.apk
"$APK" adbsign --allow-untrusted --reset-signatures --sign-key /keys/r4ven-apk.pem packages.adb
mkdir -p /tmp/trusted && cp /keys/r4ven-apk.pub /tmp/trusted/
"$APK" --keys-dir /tmp/trusted --no-network --repository /out/packages.adb search -v
