const { checkFluxNodeExistence } = require('./flux-api');

/**
 * Scans a single IP address for all possible Flux nodes (up to 8).
 * @param {string} ip The IP address to scan.
 * @param {string} ipPrefix A prefix for generating unique node IDs.
 * @param {Logger} logger Logger instance.
 * @returns {Promise<object[]>} A promise that resolves to an array of found node objects.
 */
async function discoverNodesOnIp(ip, ipPrefix, logger) {
    logger.log('DISCOVERY', `Scanning IP: ${ip} with prefix ${ipPrefix}`);
    const promises = [];
    const baseUiPort = 16126;
    const maxNodesPerIp = 8;

    for (let i = 0; i < maxNodesPerIp; i++) {
        const uiPort = baseUiPort + (i * 10);
        const apiPort = uiPort + 1;
        const apiUrl = `http://${ip}:${apiPort}`;
        
        logger.log('DISCOVERY', `Checking for node at ${apiUrl}...`);
        
        const promise = checkFluxNodeExistence(apiUrl, logger).then(exists => {
            if (exists) {
                const nodeNumber = i + 1;
                const paddedNodeNumber = String(nodeNumber).padStart(2, '0');
                const node = {
                    id: `${ipPrefix}-node${paddedNodeNumber}`,
                    name: `${ipPrefix}-Node${paddedNodeNumber}`,
                    uiUrl: `http://${ip}:${uiPort}`,
                    apiUrl: apiUrl,
                    view: null,
                    token: null,
                    automationIntervalId: null
                };
                logger.log('DISCOVERY', `Found active node: ${node.name}`);
                return node;
            }
            return null;
        });
        promises.push(promise);
    }

    const results = await Promise.all(promises);
    return results.filter(node => node !== null);
}

module.exports = { discoverNodesOnIp };
