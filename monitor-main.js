const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fetch = require('node-fetch');

let zelidauth_token = null;
let automationIntervalId = null; // Variable to hold the interval ID
const TARGET_APP_PREFIX = "StuckContainer";
const API_BASE_URL = 'http://1.2.3.4:16127';

// --- Function Definitions ---

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'monitor-preload.js'),
      sandbox: false
    }
  });

  mainWindow.loadURL('http://1.2.3.4:16126/');
  mainWindow.webContents.openDevTools();
}

async function isTokenValid() {
    if (!zelidauth_token) {
        return false;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/id/loggedsessions`, {
            method: 'GET',
            headers: { 'zelidauth': zelidauth_token }
        });
        // If status is 200-299, token is valid. Otherwise, it's not.
        return response.ok;
    } catch (error) {
        console.error('[API] Error during token validation:', error);
        return false; // Network errors also mean we can't proceed.
    }
}

async function listRunningApps() {
    if (!zelidauth_token) {
        console.log('[API] Error: Not logged in. zelidauth_token is missing.');
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/apps/listrunningapps`, {
            method: 'GET',
            headers: { 'zelidauth': zelidauth_token }
        });
        const data = await response.json();
        console.log('[API] Running Apps:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('[API] Error listing running apps:', error);
    }
}

async function removeApp(appName) {
    if (!zelidauth_token) {
        console.log('[API] Error: Not logged in. zelidauth_token is missing.');
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/apps/appremove?appname=${appName}`, {
            method: 'GET',
            headers: { 'zelidauth': zelidauth_token }
        });
        const data = await response.json();
        console.log(`[API] Remove response for ${appName}:`, JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error(`[API] Error removing app ${appName}:`, error);
    }
}

async function runAutomationCycle() {
  // Heartbeat Check: Verify token is still valid before proceeding
  const tokenIsValid = await isTokenValid();
  if (!tokenIsValid) {
    console.log('[MAIN] Auth token has expired or is invalid. Pausing automation.');
    // Stop the automation loop
    clearInterval(automationIntervalId);
    automationIntervalId = null;
    zelidauth_token = null;
    return; // End this cycle
  }

  console.log('[AUTOMATION] Checking for target applications to remove...');
  const appsResponse = await listRunningApps();
  if (appsResponse && appsResponse.status === 'success' && appsResponse.data) {
    for (const app of appsResponse.data) {
      if (app.Names && app.Names.length > 0) {
        let containerName = app.Names[0];
        if (containerName.startsWith('/')) {
          containerName = containerName.substring(1);
        }
        if (containerName.includes(TARGET_APP_PREFIX)) {
          const mainAppName = containerName.substring(containerName.indexOf(TARGET_APP_PREFIX));
          console.log(`[AUTOMATION] Found target app component: ${containerName}. Attempting to remove main app: ${mainAppName}...`);
          await removeApp(mainAppName);
        }
      }
    }
  } else if (zelidauth_token) { // Only log errors if we are supposed to be logged in
    console.log('[AUTOMATION] Could not retrieve running apps. API might be down.');
  }
}

// --- App Lifecycle ---

app.whenReady().then(() => {
  createWindow();

  ipcMain.on('auth-state-changed', (event, authState) => {
    if (authState.loggedIn) {
      console.log('[MAIN] Received LOGIN notification.');
      zelidauth_token = authState.token;
      // Start the automation loop only if it's not already running
      if (!automationIntervalId) {
        console.log('[MAIN] Starting automation...');
        runAutomationCycle(); // Run immediately on login
        automationIntervalId = setInterval(runAutomationCycle, 60000); // Then every 60 seconds
      }
    } else {
      console.log('[MAIN] Received LOGOUT notification.');
      zelidauth_token = null;
      // Stop the automation loop if it is running
      if (automationIntervalId) {
        console.log('[MAIN] Stopping automation...');
        clearInterval(automationIntervalId);
        automationIntervalId = null;
      }
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  app.quit();
});