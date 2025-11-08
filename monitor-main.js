const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');
const ini = require('ini');

// Disable hardware acceleration to prevent rendering issues
app.disableHardwareAcceleration();

// --- Load Configuration from settings.ini ---
const config = ini.parse(fs.readFileSync(path.join(__dirname, 'settings.ini'), 'utf-8'));

const TARGET_APP_PREFIXES = (config.General.TargetAppPrefixes || '').split(',').map(p => p.trim()).filter(p => p.length > 0);
const AUTOMATION_INTERVAL = (parseInt(config.General.AutomationIntervalSeconds) || 60) * 1000;
const DEBUG_MODE = String(config.General.Debug).toLowerCase() === 'true';
const WINDOW_WIDTH = parseInt(config.General.WindowWidth) || 1200;
const WINDOW_HEIGHT = parseInt(config.General.WindowHeight) || 800;

// --- Build Node Configuration from settings.ini ---
const NODES = Object.keys(config)
  .filter(key => key.startsWith('Node'))
  .map(key => {
    const nodeConfig = config[key];
    return {
      id: key.toLowerCase(),
      name: nodeConfig.Name,
      uiUrl: nodeConfig.UI_URL,
      apiUrl: nodeConfig.API_URL,
      window: null,
      token: null,
      automationIntervalId: null
    };
  });

// --- Function Definitions ---

function createWindow(node) {
  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    webPreferences: {
      preload: path.join(__dirname, 'monitor-preload.js'),
      // Pass node ID and debug flag to preload script
      additionalArguments: [`--node-id=${node.id}`, `--debug-mode=${DEBUG_MODE}`],
      sandbox: false
    }
  });

  win.setTitle(node.name);
  win.loadURL(node.uiUrl);
  if (DEBUG_MODE) {
    win.webContents.openDevTools();
  }

  // Store window reference in the node object
  node.window = win;
}

async function listRunningApps(node) {
    if (!node.token) {
        console.log(`[API-${node.id}] Error: Not logged in. Token is missing.`);
        return null;
    }
    try {
        const response = await fetch(`${node.apiUrl}/apps/listrunningapps`, {
            method: 'GET',
            headers: { 'zelidauth': node.token }
        });
        const data = await response.json();
        if (DEBUG_MODE) {
          console.log(`[API-${node.id}] Running Apps:`, JSON.stringify(data, null, 2));
        }
        return data;
    } catch (error) {
        console.error(`[API-${node.id}] Error listing running apps:`, error);
        return null;
    }
}

async function removeApp(node, appName) {
    if (!node.token) {
        console.log(`[API-${node.id}] Error: Not logged in. Token is missing.`);
        return null;
    }
    try {
        const response = await fetch(`${node.apiUrl}/apps/appremove?appname=${appName}`, {
            method: 'GET',
            headers: { 'zelidauth': node.token }
        });
        // Return the full response object for status checking
        return response;
    } catch (error) {
        console.error(`[API-${node.id}] Error removing app ${appName}:`, error);
        return null;
    }
}

async function runAutomationCycle(node) {
  console.log(`[AUTOMATION-${node.id}] Cycle started.`);

  console.log(`[AUTOMATION-${node.id}] Checking for target applications to remove...`);
  const appsResponse = await listRunningApps(node);

  if (appsResponse && appsResponse.status === 'success' && appsResponse.data) {
    for (const app of appsResponse.data) {
      if (app.Names && app.Names.length > 0) {
        let containerName = app.Names[0];
        if (containerName.startsWith('/')) {
          containerName = containerName.substring(1);
        }
        const prefixMatch = TARGET_APP_PREFIXES.find(prefix => containerName.includes(prefix));
        if (prefixMatch) {
          const mainAppName = containerName.substring(containerName.lastIndexOf('_') + 1);
          console.log(`[AUTOMATION-${node.id}] Found target app component: ${containerName} (prefix: ${prefixMatch}). Attempting to remove main app: ${mainAppName}...`);
          
          const removeResponse = await removeApp(node, mainAppName);

          if (removeResponse && !removeResponse.ok) {
            // Reactive Auth Check: If removeApp failed due to authentication, pause automation
            if (removeResponse.status === 401 || removeResponse.status === 403) {
              console.log(`[MAIN-${node.id}] Authentication failed during removeApp. Token is invalid. Pausing automation.`);
              clearInterval(node.automationIntervalId);
              node.automationIntervalId = null;
              node.token = null;
              break; // Stop processing other apps this cycle, as token is bad
            }
          } else if (removeResponse && removeResponse.ok) {
             if (DEBUG_MODE) {
                const responseText = await removeResponse.text();
                console.log(`[API-${node.id}] Raw remove response for ${mainAppName}:`, responseText);
                try {
                    const jsonStrings = responseText.split('}{');
                    const parsedObjects = [];

                    jsonStrings.forEach((jsonStr, index) => {
                        let currentJson = jsonStr;
                        if (index > 0) { // All parts except the first need an opening brace
                            currentJson = '{' + currentJson;
                        }
                        if (index < jsonStrings.length - 1) { // All parts except the last need a closing brace
                            currentJson = currentJson + '}';
                        }

                        try {
                            const data = JSON.parse(currentJson);
                            parsedObjects.push(data);
                            console.log(`[API-${node.id}] Parsed step ${parsedObjects.length} for ${mainAppName}:`, JSON.stringify(data, null, 2));
                        } catch (parseError) {
                            console.error(`[API-${node.id}] Failed to parse step ${index + 1} of remove response for ${mainAppName}. Error: ${parseError.message}. Part: ${currentJson}`);
                        }
                    });

                    if (parsedObjects.length > 0) {
                        console.log(`[API-${node.id}] Final status for ${mainAppName}:`, JSON.stringify(parsedObjects[parsedObjects.length - 1], null, 2));
                    }

                } catch (e) {
                    console.error(`[API-${node.id}] General error processing remove response for ${mainAppName}. Error: ${e.message}`);
                }
             } else {
                // Still need to consume the response body, even if not logging
                await removeResponse.text();
             }
          }
        }
      }
    }
  } else if (node.token) {
    console.log(`[AUTOMATION-${node.id}] Could not retrieve running apps. API might be down.`);
  }
}

// --- App Lifecycle ---

app.whenReady().then(() => {
  // Create a window for each configured node
  NODES.forEach(node => createWindow(node));

  ipcMain.on('auth-state-changed', (event, authState) => {
    const node = NODES.find(n => n.id === authState.nodeId);
    if (!node) return;

    if (authState.loggedIn) {
      console.log(`[MAIN-${node.id}] Received LOGIN notification.`);
      node.token = authState.token;
      if (!node.automationIntervalId) {
        console.log(`[MAIN-${node.id}] Starting automation in 5 seconds...`);
        // Add a delay to prevent a race condition on new session validation
        setTimeout(() => {
          console.log(`[MAIN-${node.id}] Initial automation cycle starting now.`);
          runAutomationCycle(node); // Run immediately after delay
          node.automationIntervalId = setInterval(() => runAutomationCycle(node), AUTOMATION_INTERVAL); // Then run at configured interval
        }, 5000); // 5-second delay
      }
    } else {
      console.log(`[MAIN-${node.id}] Received LOGOUT notification.`);
      node.token = null;
      if (node.automationIntervalId) {
        console.log(`[MAIN-${node.id}] Stopping automation...`);
        clearInterval(node.automationIntervalId);
        node.automationIntervalId = null;
      }
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      NODES.forEach(node => createWindow(node));
    }
  });
});

app.on('window-all-closed', function () {
  app.quit();
});