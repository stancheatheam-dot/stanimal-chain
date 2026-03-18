const express = require('express');
const crypto = require('crypto');

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

class Block {
  constructor(index, timestamp, transactions, previousHash, validator) {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.validator = validator;
    this.hash = sha256(JSON.stringify({
      index: this.index,
      timestamp: this.timestamp,
      transactions: this.transactions,
      previousHash: this.previousHash,
      validator: this.validator
    }));
  }
  isValid() {
    return this.hash === sha256(JSON.stringify({
      index: this.index,
      timestamp: this.timestamp,
      transactions: this.transactions,
      previousHash: this.previousHash,
      validator: this.validator
    }));
  }
}

function createGenesisBlock() {
  return new Block(
    0,
    new Date('2024-01-01').getTime(),
    [{ from: 'System', to: 'Genesis', amount: 0 }],
    '0000000000000000000000000000000000000000000000000000000000000000',
    'System'
  );
}

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
  registerValidator(address, name, stakeAmount) {
    if (stakeAmount < 10) throw new Error('Minimum stake is 10 STAN');
    if (this.validators.has(address)) throw new Error('Already a validator');
