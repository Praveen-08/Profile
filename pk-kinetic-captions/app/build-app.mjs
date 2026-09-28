/**
 * Build the macOS .app bundle.
 *
 * A .app is a directory with a fixed shape, so this works anywhere — it does
 * not need Xcode, a developer account, or macOS itself to assemble. The
 * project path is baked into the launcher at build time, which is why moving
 * the project means running this again.
 *
 * The bundle is not code-signed. On first open macOS will say it is from an
 * unidentified developer; right-click ▸ Open once and it is trusted from then
 * on. Signing needs a paid Apple Developer account and is a distribution
 * concern, not a working-on-your-own-Mac concern.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..');
export const APP_NAME = 'PK Kinetic Captions';

/**
 * @param {{outDir?: string, projectDir?: string, version?: string}} [opts]
 * @returns {Promise<{app: string, files: string[], warnings: string[]}>}
 */
export async function buildApp(opts = {}) {
  const projectDir = path.resolve(opts.projectDir ?? PROJECT);
  const outDir = path.resolve(opts.outDir ?? path.join(process.env.HOME ?? '.', 'Applications'));
  const version = opts.version ?? await readVersion(projectDir);
  /** @type {string[]} */ const warnings = [];

  const app = path.join(outDir, `${APP_NAME}.app`);
  const contents = path.join(app, 'Contents');
  const macos = path.join(contents, 'MacOS');
  const resources = path.join(contents, 'Resources');

  // Rebuild from scratch so a stale launcher can never survive.
  await fs.rm(app, { recursive: true, force: true });
  await fs.mkdir(macos, { recursive: true });
  await fs.mkdir(resources, { recursive: true });

  const plist = (await fs.readFile(path.join(HERE, 'Info.plist'), 'utf8')).replaceAll('__VERSION__', version);
  await fs.writeFile(path.join(contents, 'Info.plist'), plist, 'utf8');
  await fs.writeFile(path.join(contents, 'PkgInfo'), 'APPL????', 'utf8');

  const launcher = (await fs.readFile(path.join(HERE, 'launcher.sh'), 'utf8'))
    .replace('__PROJECT_DIR__', projectDir.replaceAll('"', '\\"'));
  const exe = path.join(macos, APP_NAME);
  await fs.writeFile(exe, launcher, 'utf8');
  await fs.chmod(exe, 0o755);

  const icon = path.join(HERE, 'AppIcon.icns');
  try {
    await fs.copyFile(icon, path.join(resources, 'AppIcon.icns'));
  } catch {
    warnings.push('AppIcon.icns is missing, so the app will use the generic icon. Rebuild it with app/make-icns, or reinstall the project.');
  }

  if (process.platform !== 'darwin') {
    warnings.push(`Built on ${process.platform}. The bundle is complete and will work once copied to a Mac, but it has not been registered with Launch Services here.`);
  }

  return {
    app,
    files: [
      path.join(contents, 'Info.plist'),
      path.join(contents, 'PkgInfo'),
      exe,
      path.join(resources, 'AppIcon.icns'),
    ],
    warnings,
  };
}

async function readVersion(projectDir) {
  try {
    return JSON.parse(await fs.readFile(path.join(projectDir, 'package.json'), 'utf8')).version ?? '1.0.0';
  } catch {
    return '1.0.0';
  }
}
