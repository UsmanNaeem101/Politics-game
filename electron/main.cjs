// The desktop shell. It opens one window on the built game (dist-desktop/, made by
// `npm run build:desktop`) and keeps outside links in the system browser. The game
// itself knows nothing of Electron and saves to the window's local storage as usual.

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

const external = (url) => /^https?:\/\//.test(url);

function open() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Crown of Whispers',
    backgroundColor: '#101219',
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (external(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:')) return;
    e.preventDefault();
    if (external(url)) shell.openExternal(url);
  });

  win.loadFile(path.join(__dirname, '..', 'dist-desktop', 'index.html'));
}

app.whenReady().then(() => {
  // macOS keeps its standard menu (Quit, copy and paste); elsewhere the game needs none.
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  open();
});

app.on('window-all-closed', () => app.quit());
