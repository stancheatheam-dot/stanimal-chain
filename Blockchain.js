const { Block, createGenesisBlock } = require('./Block');

const MAX_SUPPLY   = 21_000_000;
const HALVING_INTERVAL = 100;       // reward halves every 100 blocks
const INITIAL_REWARD   = 50;        // STAN per block

function getBlockReward(blockIndex) {
  const halvings = Math.floor(blockIndex / HALVING_INTERVAL);
  return Math.floor(INITIAL_REWARD / Math.pow(2, halvings));
}

class Blockchain {
  constructor() {
    this.chain       = [createGenesisBlock()];
    this.mempool     = [];           // pending transactions
    this.validators  = new Map();    // address -> { name, stake, rewards }
    this.wallets     = new Map();    // address -> balance
    this.products    = new Map();    // productId -> product record
    this.proposals   = new Map();    // proposalId -> governance proposal
    this.circulating = 0;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

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

  // ── Proof of Stake ─────────────────────────────────────────────────────────

  registerValidator(address, name, stakeAmount) {
    if (stakeAmount < 10) throw new Error('Minimum stake is 10 STAN');
    if (this.validators.has(address)) throw new Error('Already a validator');
    this.debit(address, stakeAmount);
    this.validators.set(address, { name, stake: stakeAmount, rewards: 0 });
    console.log(`[PoS] ${name} registered as validator with ${stakeAmount} STAN staked`);
    return true;
  }

  // Weighted random selection: higher stake = higher probability
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

  // ── Block Proposal ─────────────────────────────────────────────────────────

  proposeBlock(validatorAddress) {
    const validator = this.validators.get(validatorAddress);
    if (!validator) throw new Error('Not a registered validator');
    if (!this.mempool.length) throw new Error('Mempool is empty — nothing to include');

    const reward = getBlockReward(this.chain.length);
    if (this.circulating + reward > MAX_SUPPLY) {
      console.warn('[Economy] Max supply reached — no block reward issued');
    }

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

    // Apply all transactions
    for (const tx of block.transactions) {
      this.applyTransaction(tx);
    }

    // Pay the validator
    if (this.circulating + reward <= MAX_SUPPLY) {
      this.credit(validatorAddress, reward);
      validator.rewards += reward;
      this.circulating += reward;
    }

    this.chain.push(block);
    this.mempool = [];

    console.log(`[Chain] Block #${block.index} added by ${validator.name} — reward: ${reward} STAN`);
    return block;
  }

  // Let the network pick the validator automatically
  proposeBlockAuto() {
    const selected = this.selectValidator();
    console.log(`[PoS] Auto-selected validator: ${selected.name}`);
    return this.proposeBlock(selected.address);
  }

  // ── Transactions ───────────────────────────────────────────────────────────

  addTransaction(tx) {
    this.validateTransaction(tx);
    this.mempool.push({ ...tx, ts: Date.now(), hash: this.hashTx(tx) });
    console.log(`[Mempool] +1 tx — type: ${tx.type || 'transfer'} | pool size: ${this.mempool.length}`);
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
      if (!tx.stealth) this.credit(tx.to, tx.amount);   // stealth = recipient hidden
    }
    // contract calls are recorded on-chain but don't move tokens
  }

  hashTx(tx) {
    const { crypto } = require('crypto');
    return require('crypto')
      .createHash('sha256')
      .update(JSON.stringify(tx) + Date.now())
      .digest('hex')
      .slice(0, 16);
  }

  // ── Supply Chain Contracts ─────────────────────────────────────────────────

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
    console.log(`[Contract] Product registered: ${name} (${id})`);
    return id;
  }

  transferProduct(fromAddress, productId, toAddress, { location, status, note } = {}) {
    const product = this.products.get(productId);
    if (!product) throw new Error('Product not found');
    if (product.currentOwner !== fromAddress) throw new Error('Not the current owner');

    product.currentOwner = toAddress;
    product.status = status || 'In transit';
    product.history.push({
      event: 'Transfer', owner: toAddress,
      location: location || 'Unknown', note: note || 'Ownership transferred',
      ts: Date.now(),
    });

    this.addTransaction({
      from: fromAddress, to: 'OwnershipTransfer',
      type: 'contract', note: `${product.name} → ${toAddress}`, productId,
    });
    console.log(`[Contract] Product ${productId} transferred to ${toAddress}`);
    return product;
  }

  // ── Governance ─────────────────────────────────────────────────────────────

  createProposal(validatorAddress, { title, description }) {
    if (!this.validators.has(validatorAddress)) throw new Error('Only validators can propose');
    const id = 'PROP-' + (this.proposals.size + 1).toString().padStart(3, '0');
    this.proposals.set(id, {
      id, title, description,
      proposer: validatorAddress,
      votes: { yes: 0, no: 0, voters: [] },
      status: 'Active',
      ts: Date.now(),
    });
    console.log(`[Gov] New proposal: ${title}`);
    return id;
  }

  vote(validatorAddress, proposalId, choice) {
    if (!this.validators.has(validatorAddress)) throw new Error('Only validators can vote');
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== 'Active') throw new Error('Voting is closed');
    if (proposal.votes.voters.includes(validatorAddress)) throw new Error('Already voted');

    const { stake } = this.validators.get(validatorAddress);
    proposal.votes[choice] += stake;
    proposal.votes.voters.push(validatorAddress);

    // Check if quorum reached (50%+ of validators voted)
    if (proposal.votes.voters.length / this.validators.size >= 0.5) {
      proposal.status = proposal.votes.yes > proposal.votes.no ? 'Passed' : 'Rejected';
      console.log(`[Gov] Proposal "${proposal.title}" ${proposal.status}`);
    }
    return proposal;
  }

  // ── Chain Validation ───────────────────────────────────────────────────────

  isValidBlock(block, previousBlock) {
    if (block.previousHash !== previousBlock.hash) {
      console.error('[Validate] Previous hash mismatch');
      return false;
    }
    if (!block.isValid()) {
      console.error('[Validate] Block hash invalid — possible tampering');
      return false;
    }
    return true;
  }

  isValidChain() {
    for (let i = 1; i < this.chain.length; i++) {
      if (!this.isValidBlock(this.chain[i], this.chain[i - 1])) return false;
    }
    return true;
  }

  // ── Serialisation (for P2P sync) ───────────────────────────────────────────

  toJSON() {
    return {
      chain:       this.chain,
      validators:  Object.fromEntries(this.validators),
      wallets:     Object.fromEntries(this.wallets),
      products:    Object.fromEntries(this.products),
      proposals:   Object.fromEntries(this.proposals),
      circulating: this.circulating,
    };
  }
}

module.exports = { Blockchain, getBlockReward, MAX_SUPPLY };
