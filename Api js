const express = require('express');

function createAPI(blockchain, p2p) {
  const app = express();
  app.use(express.json());

  // ── Info ──────────────────────────────────────────────────────────────────
  app.get('/', (req, res) => res.json({
    name:        'Stanimal Chain',
    version:     '1.0.0',
    blocks:      blockchain.chain.length,
    peers:       p2p.peerCount,
    validators:  blockchain.validators.size,
    circulating: blockchain.circulating,
    chainValid:  blockchain.isValidChain(),
  }));

  // ── Chain ─────────────────────────────────────────────────────────────────
  app.get('/chain',          (req, res) => res.json(blockchain.chain));
  app.get('/chain/latest',   (req, res) => res.json(blockchain.latestBlock));
  app.get('/chain/validate', (req, res) => res.json({ valid: blockchain.isValidChain(), blocks: blockchain.chain.length }));

  // ── Transactions ──────────────────────────────────────────────────────────
  app.get('/mempool', (req, res) => res.json(blockchain.mempool));

  app.post('/transaction', (req, res) => {
    try {
      blockchain.addTransaction(req.body);
      p2p.broadcastTransaction(req.body);
      res.json({ success: true, mempoolSize: blockchain.mempool.length });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Block Proposal (PoS) ──────────────────────────────────────────────────
  app.post('/block/propose', (req, res) => {
    try {
      const block = blockchain.proposeBlockAuto();
      p2p.broadcastBlock(block);
      res.json({ success: true, block });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/block/propose/:address', (req, res) => {
    try {
      const block = blockchain.proposeBlock(req.params.address);
      p2p.broadcastBlock(block);
      res.json({ success: true, block });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Validators ────────────────────────────────────────────────────────────
  app.get('/validators', (req, res) => res.json(Object.fromEntries(blockchain.validators)));

  app.post('/validators/register', (req, res) => {
    try {
      const { address, name, stake } = req.body;
      blockchain.registerValidator(address, name, Number(stake));
      res.json({ success: true, validator: blockchain.validators.get(address) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Wallets ───────────────────────────────────────────────────────────────
  app.get('/wallet/:address', (req, res) => {
    res.json({ address: req.params.address, balance: blockchain.getBalance(req.params.address) });
  });

  app.post('/wallet/fund', (req, res) => {
    const { address, amount } = req.body;
    if (!address || !amount) return res.status(400).json({ error: 'address and amount required' });
    blockchain.credit(address, Number(amount));
    res.json({ success: true, balance: blockchain.getBalance(address) });
  });

  // ── Supply Chain ──────────────────────────────────────────────────────────
  app.get('/products',     (req, res) => res.json(Object.fromEntries(blockchain.products)));
  app.get('/products/:id', (req, res) => {
    const product = blockchain.products.get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  });

  app.post('/products', (req, res) => {
    try {
      const { ownerAddress, name, batch, origin } = req.body;
      const id = blockchain.registerProduct(ownerAddress, { name, batch, origin });
      res.json({ success: true, productId: id, product: blockchain.products.get(id) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/products/:id/transfer', (req, res) => {
    try {
      const { fromAddress, toAddress, location, status, note } = req.body;
      const product = blockchain.transferProduct(fromAddress, req.params.id, toAddress, { location, status, note });
      res.json({ success: true, product });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Governance ────────────────────────────────────────────────────────────
  app.get('/governance', (req, res) => res.json(Object.fromEntries(blockchain.proposals)));

  app.post('/governance/propose', (req, res) => {
    try {
      const { validatorAddress, title, description } = req.body;
      const id = blockchain.createProposal(validatorAddress, { title, description });
      res.json({ success: true, proposalId: id, proposal: blockchain.proposals.get(id) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/governance/:id/vote', (req, res) => {
    try {
      const { validatorAddress, choice } = req.body;
      const proposal = blockchain.vote(validatorAddress, req.params.id, choice);
      res.json({ success: true, proposal });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Peers ─────────────────────────────────────────────────────────────────
  app.get('/peers',  (req, res) => res.json({ count: p2p.peerCount }));
  app.post('/peers', (req, res) => {
    p2p.connectToPeer(req.body.url);
    res.json({ success: true });
  });

  return app;
}

module.exports = { createAPI };
