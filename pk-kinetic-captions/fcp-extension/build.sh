#!/bin/bash
#
# Build and install the Final Cut panel.
#
#   ./build.sh            build, install, register, verify
#   ./build.sh --check    diagnose only, change nothing
#
# Every step says what it is doing and stops on the first real problem, with
# the reason. A silent failure here means an empty Window ▸ Extensions menu
# and nothing to go on.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="PKKineticCaptions"
EXT_ID="nz.pkvisuals.kinetic-captions.extension"
DEST="/Applications"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; }
note() { printf '    %s\n' "$1"; }
die()  { printf '\n\033[31m%s\033[0m\n\n' "$1"; exit 1; }

CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

bold "Environment"

[ "$(uname -s)" = "Darwin" ] || die "This builds a macOS app extension and needs a Mac."
ok "macOS $(sw_vers -productVersion)"

if ! xcode-select -p >/dev/null 2>&1; then
  die "Xcode is not installed, or its command line tools are not selected.
Install Xcode from the App Store, then run:
  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
fi
ok "Xcode at $(xcode-select -p)"

if ! command -v xcodebuild >/dev/null 2>&1; then
  die "xcodebuild not found. Open Xcode once to finish its setup, then try again."
fi

# The command line tools alone cannot build an app extension.
if ! xcodebuild -version >/dev/null 2>&1; then
  die "xcodebuild will not run. This usually means only the Command Line Tools are
installed, not Xcode itself. Install Xcode from the App Store, then:
  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
fi
ok "$(xcodebuild -version | head -1)"

command -v node >/dev/null 2>&1 && ok "node $(node -v)" || bad "node not found — the engine will not be refreshed into the panel"

if command -v xcodegen >/dev/null 2>&1; then
  ok "xcodegen $(xcodegen --version 2>/dev/null | head -1)"
else
  bad "xcodegen not installed"
  if [ "$CHECK_ONLY" = 1 ]; then
    note "install it with: brew install xcodegen"
  else
    command -v brew >/dev/null 2>&1 || die "xcodegen is needed to generate the Xcode project, and Homebrew is not
installed to fetch it. Install Homebrew from brew.sh, then: brew install xcodegen"
    bold "Installing xcodegen"
    brew install xcodegen || die "brew install xcodegen failed."
  fi
fi

bold "Already installed?"
if [ -d "$DEST/$APP_NAME.app" ]; then
  ok "$DEST/$APP_NAME.app exists"
else
  bad "$DEST/$APP_NAME.app is not there — Final Cut has nothing to list"
fi

if pluginkit -m -p com.apple.FinalCut.WorkflowExtension 2>/dev/null | grep -q "$EXT_ID"; then
  ok "the extension is registered with macOS"
else
  bad "the extension is NOT registered with macOS"
  note "macOS registers an extension when its host app is launched at least once,"
  note "and only from /Applications or ~/Applications."
fi

if [ "$CHECK_ONLY" = 1 ]; then
  bold "Diagnosis only — nothing was changed."
  echo
  exit 0
fi

bold "Bundling the engine"
if command -v node >/dev/null 2>&1; then
  node "$HERE/scripts/bundle-web.mjs" >/dev/null || die "Bundling the engine failed. Run it directly to see why:
  node $HERE/scripts/bundle-web.mjs"
  ok "engine copied into Extension/Resources/web"
else
  bad "skipped — node not found"
fi

bold "Generating the Xcode project"
( cd "$HERE" && xcodegen ) || die "xcodegen failed. Check fcp-extension/project.yml."
ok "$APP_NAME.xcodeproj"

bold "Building"
# Ad-hoc signing ("-"), not unsigned: macOS refuses to register an unsigned
# app extension, and refuses it silently — an empty Extensions menu with no
# error anywhere. Ad-hoc is enough for a panel running on this Mac only.
BUILD_DIR="$HERE/.build"
if ! xcodebuild \
  -project "$HERE/$APP_NAME.xcodeproj" \
  -scheme "$APP_NAME" \
  -configuration Release \
  -derivedDataPath "$BUILD_DIR" \
  CODE_SIGN_IDENTITY="-" \
  CODE_SIGN_STYLE=Manual \
  DEVELOPMENT_TEAM="" \
  CODE_SIGNING_REQUIRED=YES \
  CODE_SIGNING_ALLOWED=YES \
  build 2>&1 | tee "$HERE/.build.log" | grep -E "error:|warning: .*(Swift|Info.plist)" ; then
  :
fi

BUILT="$BUILD_DIR/Build/Products/Release/$APP_NAME.app"
if [ ! -d "$BUILT" ]; then
  echo
  die "The build did not produce $APP_NAME.app.
The full log is at $HERE/.build.log — the errors are near the end:
  grep -n 'error:' $HERE/.build.log

Expect ProExtensionTimelineBridge.swift to need the real selector names from
Final Cut's SDK. Everything else talks to the TimelineBridge protocol, so it
should be the only file to change."
fi
ok "built $BUILT"

bold "Installing"
rm -rf "${DEST:?}/$APP_NAME.app"
cp -R "$BUILT" "$DEST/" || die "Could not copy into $DEST. Try again with sudo, or install to ~/Applications."
ok "$DEST/$APP_NAME.app"

# macOS only registers an extension once its host app has run.
open "$DEST/$APP_NAME.app" || die "Could not launch the app. Open it from Finder once — that is what registers the panel."
sleep 3
ok "launched once to register the panel"

bold "Verifying"
if pluginkit -m -p com.apple.FinalCut.WorkflowExtension 2>/dev/null | grep -q "$EXT_ID"; then
  ok "registered"
  echo
  bold "Done. In Final Cut: Window ▸ Extensions ▸ PK Kinetic Captions."
  note "If Final Cut was already open, quit and reopen it."
else
  bad "still not registered"
  echo
  note "Try, in order:"
  note "  pluginkit -a '$DEST/$APP_NAME.app/Contents/PlugIns/PKCaptionsExtension.appex'"
  note "  open '$DEST/$APP_NAME.app'   # launch it once more"
  note "  quit and reopen Final Cut Pro"
  note ""
  note "If it still does not appear, the extension point in Extension/Info.plist"
  note "may not match this version of Final Cut. Check what your Final Cut accepts:"
  note "  pluginkit -m -p com.apple.FinalCut.WorkflowExtension -vvv"
fi
echo
