const { Block, createGenesisBlock } = require('./Block');

const MAX_SUPPLY   = 21_000_000;
const HALVING_INTERVAL = 100;
const INITIAL_REWARD   = 50;

function getBlockReward(blockIndex) {
  const halvings = Math.floor(blockIndex / HALVING_INTERVAL);
  return Math.floor(INITIAL_REWARD / Math.pow(2, halvings));
}

class Blockchain {
  constructor() {
    this.chain       = [createGenesisBlock()];
    this.mempool     = [];
    this.validators  = new Map();
    this.wallets     = new Map();
    this.products    = new Map();
    this.proposals   = new Map();
    this.circulating = 0;
  }

  get latestBlock() {
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
    if (bal < amount) throw new Error(`Insufficient balance for ${address}`);
    this.wallets.set(address, bal - amount);
  }

  registerValidator(address, name, stakeAmount) {
    if (stakeAmount < 10) throw new Error('Minimum stake is 10 STAN');
    if (this.validators.has(address)) throw new Error('Already a validator');
    this.debit(address, stakeAmount);
    this.validators.set(address, { name, stake: stakeAmount, rewards: 0 });
    return true;
  }

  selectValidator() {
    const vals = Array.from(this.validators.entries());
    if (!vals.length) throw new Error('No validators registered');
    const totalStake = vals.reduce((sum, [, v]) => sum + v.stake, 0);
    let rand = Math.random() * totalStake;
    for (const [address, v] of vals) {
      rand -= v.stake;
      if (rand <= 0) return { address, ...v };
    }
    return { address: vals[0][0], ...vals[0][1] };
  }

  proposeBlock(validatorAddress) {
    const validator = this.validators.get(validatorAddress);
    if (!validator) throw new Error('Not a registered validator');
    if (!this.mempool.length) throw new Error('Mempool is empty');

    const reward = getBlockReward(this.chain.length);
    const block = new Block(
      this.chain.length,
      Date.now(),
      [...this.mempool],
      this.latestBlock.hash,
      validatorAddress
    );

    if (!this.isValidBlock(block, this.latestBlock)) {
      throw new Error('Block failed validation');
    }

    for (const tx of block.transactions) {
      this.applyTransaction(tx);
    }

    if (this.circulating + reward <= MAX_SUPPLY) {
      this.credit(validatorAddress, reward);
      validator.rewards += reward;
      this.circulating += reward;
    }

    this.chain.push(block);
    this.mempool = [];
    return block;
  }

  proposeBlockAuto() {
    const selected = this.selectValidator();
    return this.proposeBlock(selected.address);
  }

  addTransaction(tx) {
    this.validateTransaction(tx);
    this.mempool.push({ ...tx, ts: Date.now() });
    return true;
  }

  validateTransaction(tx) {
    if (!tx.from || !tx.to) throw new Error('Transaction must have from and to');
    if (tx.type === 'transfer') {
      if (!tx.amount || tx.amount <= 0) throw new Error('Invalid amount');
      const bal = this.getBalance(tx.from);
      if (bal < tx.amount) throw new Error(`Insufficient balance: have ${bal}, need ${tx.amount}`);
    }
  }

  applyTransaction(tx) {
    if (tx.type === 'transfer') {
      this.debit(tx.from, tx.amount);
      if (!tx.stealth) this.credit(tx.to, tx.amount);
    }
  }

  registerProduct(ownerAddress, { name, batch, origin }) {
    const id = 'PRD-' + require('crypto').randomBytes(3).toString('hex').toUpperCase();
    const product = {
      id, name, batch, origin,
      currentOwner: ownerAddress,
      status: 'Registered',
      history: [{
        event: 'Registered', owner: ownerAddress,
        location: origin, note: 'On-chain registration',
        ts: Date.now(),
      }],
    };
    this.products.set(id, product);
    this.addTransaction({
      from: ownerAddress, to: 'ProductRegistry',
      type: 'contract', note: `Register: ${name}`, productId: id,
    });
    return id;
  }

  transferProduct(fromAddress, productId, toAddress, { location, status, note } = {}) {
    const product = this.products.get(product
