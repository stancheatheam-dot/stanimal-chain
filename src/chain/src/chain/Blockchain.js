const crypto = require('crypto');
const Block = require('./Block').Block;
const createGenesisBlock = require('./Block').createGenesisBlock;

class Blockchain {
  constructor() {
    this.chain = [createGenesisBlock()];
    this.mempool = [];
    this.validators = new Map();
    this.wallets = new Map();
    this.products = new Map();
    this.proposals = new Map();
    this.circulating = 0;
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  getBalance(address) {
    return this.wallets.get(address) || 0;
  }

  credit(address, amount) {
    this.wallets.set(address, (this.wallets.get(address) || 0) + amount);
  }

  debit(address, amount) {
    const bal = this.wallets.get(address) || 0;
    if (bal < amount) throw new Error('Insufficient balance');
    this.wallets.set(address, bal - amount);
  }

  isValidChain() {
    return true;
  }

  toJSON() {
    return { chain: this.chain };
  }
}

module.exports = { Blockchain: Blockchain };
