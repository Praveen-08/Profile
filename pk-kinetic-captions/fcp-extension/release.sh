#!/bin/bash
#
# Build a customer copy, then notarize and staple it.
#
#   PKKC_STORE_ID=… PKKC_PRODUCT_IDS=… PKKC_TRIAL_PRODUCT_ID=… ./release.sh
#
# It rebuilds with PKKC_RELEASE=1, so the copy carries no owner unlock, and
# refuses to ship one without the store id (it could not take licence keys).
#
# Apple checks the app for malware and records that it did; the stapled ticket
# lets it open on a customer's Mac without a warning, even offline. Uses the
# notarytool profile stored once with:
#   xcrun notarytool store-credentials 08labs --apple-id … --team-id W7SLDL8U36
set -euo pipefail
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="/Applications/PKKineticCaptions.app"
PROFILE="${NOTARY_PROFILE:-08labs}"
DIST="$HERE/dist"
ZIP="$DIST/PKKineticCaptions.zip"

[ -n "${PKKC_STORE_ID:-}" ] || { echo "Set PKKC_STORE_ID (and PKKC_PRODUCT_IDS) to the Lemon Squeezy ids first."; exit 1; }
echo "▸ building the customer copy"
PKKC_RELEASE=1 "$HERE/build.sh"
PLIST="$APP/Contents/PlugIns/PKCaptionsExtension.appex/Contents/Info.plist"
[ -z "$(/usr/libexec/PlistBuddy -c 'Print :TFOwnerDevice' "$PLIST" 2>/dev/null)" ] \
  || { echo "The build still carries an owner unlock — refusing to release it."; exit 1; }

mkdir -p "$DIST"
echo "▸ checking the signature"
codesign --verify --deep --strict --verbose=1 "$APP"
SIG=$(codesign -dv --verbose=2 "$APP" 2>&1)
[[ "$SIG" == *"Authority=Developer ID Application"* ]] \
  || { echo "Not signed with a Developer ID — run ./build.sh on a Mac with the certificate."; exit 1; }

echo "▸ notarizing (a few minutes)"
rm -f "$ZIP"
/usr/bin/ditto -c -k --keepParent "$APP" "$ZIP"
xcrun notarytool submit "$ZIP" --keychain-profile "$PROFILE" --wait | tee "$DIST/notary.log"
grep -q "status: Accepted" "$DIST/notary.log" || {
  ID=$(grep -m1 "id:" "$DIST/notary.log" | awk '{print $2}')
  xcrun notarytool log "$ID" --keychain-profile "$PROFILE" || true
  exit 1
}

echo "▸ stapling the ticket"
xcrun stapler staple "$APP"
xcrun stapler validate "$APP"
rm -f "$ZIP"
/usr/bin/ditto -c -k --keepParent "$APP" "$ZIP"

echo "▸ what a customer's Mac will say:"
spctl -a -vvv -t exec "$APP" 2>&1 | tail -3
echo
echo "ready: $ZIP"
