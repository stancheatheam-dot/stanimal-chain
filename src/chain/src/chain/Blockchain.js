const crypto = require('crypto');
const Block = require('./Block').Block;
const createGenesisBlock = require('./Block').createGenesisBlock;

const MAX_SUPPLY = 21000000;
const HALVING_INTERVAL = 100;
const INITIAL_REWARD = 50;

function getBlockReward(blockIndex) {
  const halvings = Math.floor(blockIndex / HALVING_INTERVAL);
  return Math.floor(INITIAL_REWARD / Math.pow(2, halvings));
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
    if (bal < amount) throw new Error('Insufficient balance for ' + address);
    this.wallets.set(address, bal - amount);
  }

  registerValidator(address, name, stakeAmount) {
    if (stakeAmount < 10) throw new Error('Minimum stake is 10 STAN');
    if (this.validators.has(address)) throw new Error('Already a validator');
    this.debit(address, stakeAmount);
    this.validators.set(address, { name: name, stake: stakeAmount, rewards: 0 });
    console.log('[PoS] ' + name + ' registered with ' + stakeAmount + ' STAN staked');
    return true;
  }

  selectValidator() {
    const vals = Array.from(this.validators.entries());
    if (!vals.length) throw new Error('No validators registered');
    const totalStake = vals.reduce(function(sum, entry) { return sum + entry[1].stake; }, 0);
    let rand = Math.random() * totalStake;
    for (let i = 0; i < vals.length; i++) {
      rand -= vals[i][1].stake;
      if (rand <= 0) return { address: vals[i][0], name: vals[i][1].name, stake: vals[i][1].stake };
    }
    return { address: vals[0][0], name: vals[0][1].name, stake: vals[0][1].stake };
  }

  proposeBlock(validatorAddress) {
    const validator = this.validators.get(validatorAddress);
    if (!validator) throw new Error('Not a registered validator');
    if (!this.mempool.length) throw new Error('Mempool is empty');
    const reward = getBlockReward(this.chain.length);
    const block = new Block(
      this.chain.length,
      Date.now(),
      this.mempool.slice(),
      this.getLatestBlock().hash,
      validatorAddress
    );
    if (!this.isValidBlock(block, this.getLatestBlock())) {
      throw new Error('Block failed validation');
    }
    for (let i = 0; i < block.transactions.length; i++) {
      this.applyTransaction(block.transactions[i]);
    }
    if (this.circulating + reward <= MAX_SUPPLY) {
      this.credit(validatorAddress, reward);
      validator.rewards += reward;
      this.circulating += reward;
    }
    this.chain.push(block);
    this.mempool = [];
    console.log('[Chain] Block #' + block.index + ' added by ' + validator.name);
    return block;
  }

  proposeBlockAuto() {
    const selected = this.selectValidator();
    console.log('[PoS] Auto-selected: ' + selected.name);
    return this.proposeBlock(selected.address);
  }

  addTransaction(tx) {
    this.validateTransaction(tx);
    tx.ts = Date.now();
    this.mempool.push(tx);
    console.log('[Mempool] +1 tx pool size: ' + this.mempool.length);
    return true;
  }

  validateTransaction(tx) {
    if (!tx.from || !tx.to) throw new Error('Transaction must have from and to');
    if (tx.type === 'transfer') {
      if (!tx.amount || tx.amount <= 0) throw new Error('Invalid amount');
      const bal = this.getBalance(tx.from);
      if (bal < tx.amount) throw new Error('Insufficient balance: have ' + bal + ' need ' + tx.amount);
    }
  }

  applyTransaction(tx) {
    if (tx.type === 'transfer') {
      this.debit(tx.from, tx.amount);
      if (!tx.stealth) this.credit(tx.to, tx.amount);
    }
  }

  registerProduct(ownerAddress, data) {
    const name = data.name;
    const batch = data.batch;
    const origin = data.origin;
    const id = 'PRD-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const product = {
      id: id,
      name: name,
      batch: batch,
      origin: origin,
      currentOwner: ownerAddress,
      status: 'Registered',
      history: [{
        event: 'Registered',
        owner: ownerAddress,
        location: origin,
        note: 'On-chain registration',
        ts: Date.now()
      }]
    };
    this.products.set(id, product);
    this.addTransaction({
      from: ownerAddress,
      to: 'ProductRegistry',
      type: 'contract',
      note: 'Register: ' + name,
      productId: id
    });
    console.log('[Contract] Product registered: ' + name);
    return id;
  }

  transferProduct(fromAddress, productId, toAddress, options) {
    if (!options) options = {};
    const product = this.products.get(productId);
    if (!product) throw new Error('Product not found');
    if (product.currentOwner !== fromAddress) throw new Error('Not the current owner');
    product.currentOwner = toAddress;
    product.status = options.status || 'In transit';
    product.history.push({
      event: 'Transfer',
      owner: toAddress,
      location: options.location || 'Unknown',
      note: options.note || 'Ownership transferred',
      ts: Date.now()
    });
    this.addTransaction({
      from: fromAddress,
      to: 'OwnershipTransfer',
      type: 'contract',
      note: product.name + ' to ' + toAddress,
      productId: productId
    });
    console.log('[Contract] Product ' + productId + ' transferred to ' + toAddress);
    return product;
  }

  createProposal(validatorAddress, data) {
    if (!this.validators.has(validatorAddress)) throw new Error('Only validators can propose');
    const id = 'PROP-' + (this.proposals.size + 1).toString().padStart(3, '0');
    this.proposals.set(id, {
      id: id,
      title: data.title,
      description: data.description,
      proposer: validatorAddress,
      votes: { yes: 0, no: 0, voters: [] },
      status: 'Active',
      ts: Date.now()
    });
    console.log('[Gov] New proposal: ' + data.title);
    return id;
  }

  vote(validatorAddress, proposalId, choice) {
    if (!this.validators.has(validatorAddress)) throw new Error('Only validators can vote');
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== 'Active') throw new Error('Voting is closed');
    if (proposal.votes.voters.includes(validatorAddress)) throw new Error('Already voted');
    const stake = this.validators.get(validatorAddress).stake;
    proposal.votes[choice] += stake;
    proposal.votes.voters.push(validatorAddress);
    if (proposal.votes.voters.length / this.validators.size >= 0.5) {
      proposal.status = proposal.votes.yes > proposal.votes.no ? 'Passed' : 'Rejected';
      console.log('[Gov] Proposal ' + proposal.title + ' ' + proposal.status);
    }
    return proposal;
  }

  isValidBlock(block, previousBlock) {
    if (block.previousHash !== previousBlock.hash) return false;
    if (!block.isValid()) return false;
    return true;
  }

  isValidChain() {
    for (let i = 1; i < this.chain.length; i++) {
      if (!this.isValidBlock(this.chain[i], this.chain[i - 1])) return false;
    }
    return true;
  }

  toJSON() {
    return {
      chain: this.chain,
      validators: Object.fromEntries(this.validators),
      wallets: Object.fromEntries(this.wallets),
      products: Object.fromEntries(this.products),
      proposals: Object.fromEntries(this.proposals),
      circulating: this.circulating
    };
  }
}

module.exports = { Blockchain: Blockchain, getBlockReward: getBlockReward, MAX_SUPPLY: MAX_SUPPLY };
