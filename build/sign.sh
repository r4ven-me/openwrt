#!/bin/bash
# Runs inside the sign image (build/Dockerfile.sign): signs the unsigned apks from CI in /dist with /keys,
# then builds the signed index (build/publish.sh, mounted at /publish.sh) into /out.
# /usr/local/bin/apk is the `apk-host` binary taken from the GitHub Release.
set -euo pipefail
APK=/usr/local/bin/apk
mkdir -p /tmp/trusted && cp /keys/r4ven-apk.pub /tmp/trusted/
shopt -s nullglob
files=(/dist/*.apk)
[ "${#files[@]}" -gt 0 ] || { echo "no apks in /dist" >&2; exit 1; }
for f in "${files[@]}"; do
	"$APK" adbsign --allow-untrusted --reset-signatures --sign-key /keys/r4ven-apk.pem "$f"
	"$APK" --keys-dir /tmp/trusted --no-network verify "$f"
done
export APK
exec /publish.sh
