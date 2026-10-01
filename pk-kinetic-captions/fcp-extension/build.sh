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

# The command line tools alone cannot build an app extension. When Xcode is
# installed but not selected — the usual state after installing the CLT —
# use it for this run rather than asking for sudo to switch globally.
if ! xcodebuild -version >/dev/null 2>&1 && [ -d /Applications/Xcode.app/Contents/Developer ]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
  note "using /Applications/Xcode.app (xcode-select points at the Command Line Tools)"
fi
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
# Signed with the Developer ID set in project.yml. Without that certificate
# (another developer's Mac) fall back to ad-hoc — never unsigned: macOS refuses
# an unsigned extension silently. An ad-hoc build works on this Mac only, and
# macOS will ask for permissions again after every rebuild.
DEV_ID="Developer ID Application: praveenkumar subramaniyan (W7SLDL8U36)"
SIGN_ARGS=()
if security find-identity -v -p codesigning | grep -q "$DEV_ID"; then
  ok "signing as $DEV_ID"
else
  bad "Developer ID not in this keychain — signing ad hoc (this Mac only)"
  SIGN_ARGS=(CODE_SIGN_IDENTITY="-" DEVELOPMENT_TEAM="" ENABLE_HARDENED_RUNTIME=NO OTHER_CODE_SIGN_FLAGS="")
fi
BUILD_DIR="$HERE/.build"
BUILT="$BUILD_DIR/Build/Products/Release/$APP_NAME.app"
APPEX="Contents/PlugIns/PKCaptionsExtension.appex"
# A previous build's product would otherwise pass the checks below even when
# this build failed.
rm -rf "$BUILT"
xcodebuild \
  -project "$HERE/$APP_NAME.xcodeproj" \
  -scheme "$APP_NAME" \
  -configuration Release \
  -destination 'generic/platform=macOS' \
  -derivedDataPath "$BUILD_DIR" \
  CODE_SIGNING_REQUIRED=YES \
  CODE_SIGNING_ALLOWED=YES \
  ${SIGN_ARGS[@]+"${SIGN_ARGS[@]}"} \
  build > "$HERE/.build.log" 2>&1
STATUS=$?
grep -E "error:|warning: .*(Swift|Info.plist)" "$HERE/.build.log" | sort -u | head -20

if [ $STATUS -ne 0 ] || [ ! -d "$BUILT" ]; then
  echo
  die "The build failed. The full log is at $HERE/.build.log:
  grep -n 'error:' $HERE/.build.log"
fi
ok "built $BUILT"

# Each of these, if missing, gives an empty Extensions menu and no error.
bold "Checking the extension"
PLIST="$BUILT/$APPEX/Contents/Info.plist"
[ "$(/usr/libexec/PlistBuddy -c 'Print :NSExtension:NSExtensionPointIdentifier' "$PLIST" 2>/dev/null)" = "com.apple.FinalCut.WorkflowExtension" ] \
  && ok "declares the Final Cut extension point" \
  || die "The built extension has no NSExtension point. Extension/Info.plist was overwritten — restore it from git."
codesign -d --entitlements - "$BUILT/$APPEX" 2>/dev/null | grep -q "com.apple.security.app-sandbox" \
  && ok "sandboxed" \
  || die "The extension is not sandboxed, and macOS refuses unsandboxed extensions. Check CODE_SIGN_ENTITLEMENTS in project.yml."
codesign -d --entitlements - "$BUILT/$APPEX" 2>/dev/null | grep -q "get-task-allow" \
  && die "The extension carries the debugger entitlement (get-task-allow). Never ship that." \
  || ok "no debugger entitlement"
otool -L "$BUILT/$APPEX/Contents/MacOS/"* 2>/dev/null | grep -q "ProExtension.framework" \
  && ok "links Final Cut's ProExtension.framework" \
  || die "The extension does not link ProExtension.framework, so it would crash on launch inside Final Cut."

bold "Installing"
rm -rf "${DEST:?}/$APP_NAME.app"
cp -R "$BUILT" "$DEST/" || die "Could not copy into $DEST. Try again with sudo, or install to ~/Applications."
ok "$DEST/$APP_NAME.app"

# Replacing the bundle invalidates its Launch Services record, and PlugInKit
# will not register an extension it cannot look up. PlugInKit must also not be
# left holding the build copy, or Final Cut runs that one instead.
LSREG=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
"$LSREG" -f "$DEST/$APP_NAME.app"
pluginkit -r "$BUILT/$APPEX" 2>/dev/null || true
pluginkit -a "$DEST/$APP_NAME.app/$APPEX" 2>/dev/null || true

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
  note "To reload a new build later, toggle the panel off and on in that menu —"
  note "never kill its process: Final Cut then refuses to relaunch it until restarted."
else
  bad "still not registered"
  echo
  note "Try, in order:"
  note "  pluginkit -a '$DEST/$APP_NAME.app/$APPEX'"
  note "  open '$DEST/$APP_NAME.app'   # launch it once more"
  note "  quit and reopen Final Cut Pro"
  note ""
  note "PlugInKit says why it refused an extension in the system log:"
  note "  log show --last 5m --predicate 'process == \"pkd\"' | grep -i kinetic"
fi
echo
