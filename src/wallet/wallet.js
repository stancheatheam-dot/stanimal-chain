const crypto = require('crypto');

function generateWallet(name) {
  const address = '0x' + crypto.randomBytes(20).toString('hex');
  const privateKey = crypto.randomBytes(32).toString('hex');
  return { name, address, privateKey };
}

function isValidAddress(address) {
  return typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address);
}

module.exports = { generateWallet, isValidAddress };
