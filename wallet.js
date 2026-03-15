const crypto = require('crypto');

// Generate a simple wallet address (in production use secp256k1 keypairs)
function generateWallet(name) {
  const address = '0x' + crypto.randomBytes(20).toString('hex');
  const privateKey = crypto.randomBytes(32).toString('hex'); // keep this secret!
  return { name, address, privateKey };
}

// Simple address validation
function isValidAddress(address) {
  return typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address);
}

module.exports = { generateWallet, isValidAddress };
