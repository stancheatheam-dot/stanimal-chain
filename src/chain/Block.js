const crypto = require('crypto');

class Block {
  constructor(index, timestamp, transactions, previousHash, validator) {
    this.index       = index;
    this.timestamp   = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.validator   = validator;
    this.hash        = this.calculateHash();
  }

  calculateHash() {
    const data = JSON.stringify({
      index:        this.index,
      timestamp:    this.timestamp,
      transactions: this.transactions,
      previousHash: this.previousHash,
      validator:    this.validator,
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  isValid() {
    return this.hash === this.calculateHash();
  }
}

function createGenesisBlock() {
  return new Block(
    0,
    new Date('2024-01-01').getTime(),
    [{ from: 'System', to: 'Genesis', amount: 0, type: 'genesis' }],
    '0'.repeat(64),
    'System'
  );
}

module.exports = { Block, createGenesisBlock };
