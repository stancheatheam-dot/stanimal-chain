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
