/**
 * Electron main process — embeds the Express + Socket.IO server
 * and opens the GURPS VTT in a BrowserWindow.
 */

import { app, BrowserWindow, Menu, shell } from 'electron';
import * as path from 'path';
import * as net from 'net';
import * as os from 'os';

// Set app name for userData path in dev mode
if (!app.isPackaged) {
  app.setName('gurps-vtt');
}

// Resolve paths relative to the actual app root. In packaged builds, Electron
// serves files from app.asar, so app.getAppPath() is the stable entry point.
const IS_DEV = !app.isPackaged;
const ROOT = IS_DEV
  ? path.join(import.meta.dirname, '..')
  : app.getAppPath();

const SERVER_DIST = path.join(ROOT, 'server', 'dist', 'server', 'src', 'index.js');
const CLIENT_DIST = path.join(ROOT, 'dist');
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const ICON_PATH = path.join(ROOT, 'assets', 'icon', 'app-icon.png');

let mainWindow: BrowserWindow | null = null;
let serverHandle: { port: number; close: () => Promise<void> } | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find a free port by briefly listening on port 0. */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (addr && typeof addr !== 'string') {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error('Could not determine port')));
      }
    });
    srv.on('error', reject);
  });
}

/** Get the machine's LAN IP for multiplayer display. */
function getLanIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// ---------------------------------------------------------------------------
// Application menu
// ---------------------------------------------------------------------------

function buildMenu(serverPort: number): void {
  const lanIP = getLanIP();
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: `Server: http://${lanIP}:${serverPort}`,
          enabled: false,
        },
        { type: 'separator' },
        {
          label: 'Open in Browser',
          click: () => shell.openExternal(`http://localhost:${serverPort}`),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------

async function createWindow(port: number): Promise<void> {
  const lanIP = getLanIP();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#111827',
    darkTheme: true,
    icon: ICON_PATH,
    title: `GURPS VTT — http://${lanIP}:${port}`,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      const port = await findFreePort();
      console.log(`[Electron] Starting server on port ${port}...`);
      console.log(`[Electron] Data directory: ${DATA_DIR}`);

      // Dynamically import the ESM server module from CJS context
      const { startServer } = await import(
        /* webpackIgnore: true */
        `file://${SERVER_DIST.replace(/\\/g, '/')}`
      );

      const handle = await startServer({
        port,
        dbDir: DATA_DIR,
        clientDist: CLIENT_DIST,
      });
      serverHandle = handle;

      console.log(`[Electron] Server running on port ${handle.port}`);

      buildMenu(handle.port);
      await createWindow(handle.port);
    } catch (err) {
      console.error('[Electron] Failed to start:', err);
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('before-quit', async () => {
    if (serverHandle) {
      console.log('[Electron] Shutting down server...');
      await serverHandle.close();
    }
  });
}
