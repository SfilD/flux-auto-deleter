const { safeStorage } = require('electron');
const { fetchWithTimeout } = require('./utils');

/**
 * Checks if a Flux node exists and is responsive at a given API URL.
 * @param {string} apiUrl The base API URL of the node to check.
 * @param {Logger} logger Logger instance.
 * @returns {Promise<boolean>} A promise that resolves to true if the node is responsive, false otherwise.
 */
async function checkFluxNodeExistence(apiUrl, logger) {
    try {
        await fetchWithTimeout(`${apiUrl}/apps/listrunningapps`, { 
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }, 10000);
        return true;
    } catch (error) {
        if (logger) logger.logDebug('DISCOVERY-Check', `Node check failed for ${apiUrl}: ${error.message}`);
        return false;
    }
}

/**
 * Fetches the list of running applications from a node.
 * @param {object} node The node object.
 * @param {Logger} logger Logger instance.
 * @returns {Promise<object[]>} A promise that resolves to an array of running application objects, or an empty array on failure.
 */
async function listRunningApps(node, logger) {
    try {
        const response = await fetchWithTimeout(`${node.apiUrl}/apps/listrunningapps`, { method: 'GET' });
        
        if (!response.ok) {
            logger.log(`API-${node.id}-Error`, `Error listing running apps: HTTP status ${response.status}`);
            return [];
        }

        const data = await response.json();
        logger.logDebug(`API-${node.id}`, 'Running Apps:', data);

        if (data.status === 'success' && Array.isArray(data.data)) {
            return data.data;
        }
        
        logger.log(`API-${node.id}-Error`, 'API call to list apps did not return a success status or valid data.');
        return [];

    } catch (error) {
        logger.log(`API-${node.id}-Error`, 'Error listing running apps:', error.message);
        return [];
    }
}

/**
 * Sends a request to remove a specific application from a node.
 * @param {object} node The node object, containing the encrypted token.
 * @param {string} appName The name of the application to remove.
 * @param {Logger} logger Logger instance.
 * @returns {Promise<object>} A promise that resolves to an object indicating success or failure.
 */
async function removeApp(node, appName, logger) {
    if (!node.token) {
        const errorMsg = 'Not logged in. Token is missing.';
        logger.log(`API-${node.id}`, `Error: ${errorMsg}`);
        return { success: false, error: errorMsg, authError: true };
    }
    try {
        let decryptedToken;
        if (Buffer.isBuffer(node.token)) {
            decryptedToken = safeStorage.decryptString(node.token);
        } else {
            decryptedToken = node.token;
        }

        const response = await fetchWithTimeout(`${node.apiUrl}/apps/appremove?appname=${appName}`, { method: 'GET', headers: { 'zelidauth': decryptedToken } });

        if (!response.ok) {
            const isAuthError = response.status === 401 || response.status === 403;
            const errorMsg = `HTTP error! Status: ${response.status}`;
            logger.log(`API-${node.id}-Error`, errorMsg);
            return { success: false, error: errorMsg, authError: isAuthError };
        }

        const responseText = await response.text();
        logger.logDebug(`API-${node.id}`, `Successfully removed app ${appName}. Server response: ${responseText}`);

        try {
            const jsonResponse = JSON.parse(responseText);
            if (jsonResponse.status === 'error') {
                const errorData = jsonResponse.data || {};
                const errorCode = errorData.code;
                const errorMessage = errorData.message || JSON.stringify(errorData);

                if (errorCode === 401 || errorCode === 403 || (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('unauthorized'))) {
                    logger.log(`API-${node.id}-Error`, 'Soft-fail: API returned 200 OK but body contains Unauthorized error.');
                    return { success: false, error: errorMessage, authError: true };
                }
                
                return { success: false, error: errorMessage, authError: false };
            }
        } catch (e) {
            // Response is not JSON, assume success
        }

        return { success: true, data: responseText };

    } catch (error) {
        logger.log(`API-${node.id}-Error`, `Error stopping application ${appName}:`, error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    checkFluxNodeExistence,
    listRunningApps,
    removeApp
};
