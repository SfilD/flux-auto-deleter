const fetch = require('node-fetch');
const dns = require('dns');

/**
 * A wrapper for the fetch API that adds a timeout.
 * @param {string} url The URL to fetch.
 * @param {object} [options={}] Fetch options.
 * @param {number} [timeout=10000] The timeout in milliseconds.
 * @returns {Promise<Response>} A promise that resolves with the fetch Response object.
 * @throws {Error} Throws an error if the request times out or fails.
 */
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout');
        }
        throw error;
    }
}

/**
 * Masks sensitive data within an object or array before logging.
 * Recursively checks for keys containing sensitive keywords and replaces their values.
 * @param {any} data The data to sanitize.
 * @returns {any} The sanitized data.
 */
function maskSensitiveData(data) {
    if (data === null || typeof data !== 'object') {
        return data;
    }

    // Create a deep copy to avoid mutating original objects
    const clonedData = JSON.parse(JSON.stringify(data));

    const sensitiveKeywords = ['token', 'password', 'signature', 'zelidauth', 'zelid', 'loginphrase'];

    // Recursive function to traverse and mask
    function recurse(current) {
        if (current === null || typeof current !== 'object') {
            return;
        }

        if (Array.isArray(current)) {
            current.forEach(item => recurse(item));
        } else {
            for (const key in current) {
                if (Object.prototype.hasOwnProperty.call(current, key)) {
                    const lowerKey = key.toLowerCase();
                    if (sensitiveKeywords.some(keyword => lowerKey.includes(keyword))) {
                        current[key] = '[REDACTED]';
                    } else {
                        recurse(current[key]);
                    }
                }
            }
        }
    }

    recurse(clonedData);
    return clonedData;
}

/**
 * Checks for a basic internet connection by attempting a DNS lookup.
 * @returns {Promise<boolean>} A promise that resolves to true if the lookup is successful, false otherwise.
 */
async function checkInternetConnection() {
    return new Promise(resolve => {
        dns.lookup('google.com', err => {
            if (err && err.code === 'ENOTFOUND') {
                resolve(false);
            }
            else {
                resolve(true);
            }
        });
    });
}

module.exports = {
    fetchWithTimeout,
    maskSensitiveData,
    checkInternetConnection
};
