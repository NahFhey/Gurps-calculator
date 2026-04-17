# Desktop Packaging Guide

This guide captures the workflow we validated while turning the project into a Windows desktop app with a custom icon, working installer, and desktop shortcut.

## What Worked Well

- Keeping the packaging work reproducible through scripts instead of one-off local tweaks.
- Verifying each milestone with a real build instead of assuming Electron Builder config was correct.
- Treating the app icon as a first-class asset with generated `png` and `ico` outputs.
- Fixing the packaged runtime path issue in the Electron main process instead of papering over it with a shortcut workaround.

## What Needed Improvement

- The first desktop shortcut was created before the packaged app had been smoke-tested.
- The packaged build used a path assumption that worked in development but not inside `app.asar`.
- Electron Builder's Windows executable-edit step failed on this machine, so the fix needed a custom `afterPack` hook.

## Current Workflow

### 1. Generate icon assets

```bash
npm run icon:generate
```

Outputs:

- `assets/icon/app-icon.ico`
- `assets/icon/app-icon.png`
- `public/favicon.ico`
- `public/favicon.png`

### 2. Build the unpacked Windows app

```bash
npm run electron:pack
```

This command now stops any running `GURPS VTT` process first so Windows file locks do not block packaging.

Primary output:

- `release/win-unpacked/GURPS VTT.exe`

### 3. Build the Windows installer

```bash
npm run electron:dist
```

Primary output:

- `release/GURPS VTT Setup <version>.exe`

### 4. Create or refresh the desktop shortcut

```bash
npm run electron:shortcut
```

This creates:

- `%USERPROFILE%\\Desktop\\GURPS VTT.lnk`

By default it points at the unpacked build in `release/win-unpacked`.

## Important Implementation Notes

### Packaged app root

In packaged builds, the Electron main process must resolve files from `app.getAppPath()` rather than assuming a `resources/app` directory. This is the key fix that stopped the packaged exe from exiting immediately on launch.

### Windows executable resource patching

The project disables Electron Builder's default Windows executable editing step and reapplies icon/version metadata in `scripts/electron-after-pack.mjs`.

This keeps the custom icon while avoiding the local permission issue that occurred when Electron Builder tried to unpack its legacy `winCodeSign` helper archive.

### Shortcut policy

The NSIS installer is configured to:

- always recreate the desktop shortcut on install/reinstall
- create a Start Menu shortcut
- use `GURPS VTT` as the shortcut name

## Recommended Habit

When touching desktop packaging in the future, keep this order:

1. `npm run electron:pack`
2. Launch `release/win-unpacked/GURPS VTT.exe`
3. `npm run electron:dist`
4. `npm run electron:shortcut` if you want the unpacked build on the desktop

That smoke test step catches packaging regressions before they get hidden behind a shortcut or installer.
