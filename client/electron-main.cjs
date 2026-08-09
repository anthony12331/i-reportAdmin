const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

let mainWindow;
let lastViolationTime = 0;
let exitFlagPath;

function createWindow() {
  mainWindow = new BrowserWindow({
    kiosk: true,
    alwaysOnTop: true,
    frame: false,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the Vite dev server
  mainWindow.loadURL('http://localhost:5173');

  // Aggressive focus stealing: Force window to front
  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      
      const now = Date.now();
      // Only log once every 5 seconds to prevent spam
      if (now - lastViolationTime > 5000) {
        lastViolationTime = now;
        mainWindow.webContents.executeJavaScript("window.dispatchEvent(new CustomEvent('security-violation-detected'));").catch(()=>{});
      }

      setTimeout(() => {
        if (!mainWindow.isFocused()) {
          mainWindow.setAlwaysOnTop(false);
          mainWindow.setAlwaysOnTop(true, 'screen-saver');
          mainWindow.focus();
        }
      }, 100);
    }
  });

  // Aggressive Task Manager Killer
  // If the user uses Ctrl+Alt+Delete and tries to open Task Manager, we kill it instantly
  // so they are forced back to the app.
  setInterval(() => {
    exec('taskkill /F /IM taskmgr.exe /T', (error, stdout) => {});
  }, 1000);
  
  // Prevent closing the window normally (e.g. Alt+F4)
  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  exitFlagPath = path.join(app.getPath('temp'), '.exit_kiosk');

  // Ensure exit flag is cleared on startup
  if (fs.existsSync(exitFlagPath)) {
    try { fs.unlinkSync(exitFlagPath); } catch(e){}
  }

  createWindow();

  // ONLY allow Ctrl+Shift+X to exit (triggers PIN overlay)
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(`
        if (!document.getElementById('kiosk-exit-overlay')) {
          const overlay = document.createElement('div');
          overlay.id = 'kiosk-exit-overlay';
          overlay.style.position = 'fixed';
          overlay.style.top = '0';
          overlay.style.left = '0';
          overlay.style.width = '100vw';
          overlay.style.height = '100vh';
          overlay.style.backgroundColor = 'rgba(0,0,0,0.9)';
          overlay.style.zIndex = '999999';
          overlay.style.display = 'flex';
          overlay.style.flexDirection = 'column';
          overlay.style.justifyContent = 'center';
          overlay.style.alignItems = 'center';
          overlay.style.color = 'white';
          overlay.style.fontFamily = 'sans-serif';
          
          overlay.innerHTML = \`
            <h2 style="margin-bottom: 20px; font-size: 28px;">Exit Kiosk Mode</h2>
            <p style="margin-bottom: 20px; color: #94a3b8;">Please enter the PIN code to unlock the terminal:</p>
            <input type="password" id="kiosk-pin-input" style="padding: 12px; font-size: 20px; text-align: center; border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: white; outline: none; margin-bottom: 20px;" autofocus>
            <div style="display: flex; gap: 10px;">
              <button id="kiosk-btn-cancel" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #334155; color: white; border: none; border-radius: 4px;">Cancel</button>
              <button id="kiosk-btn-submit" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #ef4444; color: white; border: none; border-radius: 4px;">Exit System</button>
            </div>
            <p id="kiosk-error-msg" style="color: #f87171; margin-top: 20px; font-weight: bold; display: none;">Incorrect PIN</p>
          \`;
          
          document.body.appendChild(overlay);
          
          const input = document.getElementById('kiosk-pin-input');
          input.focus();
          
          const closeOverlay = () => {
            document.body.removeChild(overlay);
          };
          
          const submitPin = () => {
            if (input.value.trim() === '12345678') {
              // Using console.log as a failsafe trigger in case 'require' is blocked by Vite
              console.log('EXIT_KIOSK_NOW_12345678');
            } else {
              document.getElementById('kiosk-error-msg').style.display = 'block';
              input.value = '';
              input.focus();
              setTimeout(() => {
                 document.getElementById('kiosk-error-msg').style.display = 'none';
              }, 2000);
            }
          };
          
          document.getElementById('kiosk-btn-cancel').onclick = closeOverlay;
          document.getElementById('kiosk-btn-submit').onclick = submitPin;
          
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitPin();
          });
          
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeOverlay();
          });
        }
      `);
    }
  });

  // Failsafe listener for the exit command
  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (message && message.includes('EXIT_KIOSK_NOW_12345678')) {
      try { fs.writeFileSync(exitFlagPath, 'exit', 'utf8'); } catch(e){}
      app.isQuiting = true;
      app.exit(0); // Instantly kills the process
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  // Prevent closing unless app.quit() is called
});
