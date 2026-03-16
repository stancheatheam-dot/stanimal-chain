# Stanimal Chain 🐾⛓

Proof of Stake supply chain blockchain with STAN token, stealth addresses, and on-chain governance.

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Run a single node (dev)
```bash
npm start
# API → http://localhost:3001
# P2P → ws://localhost:6001
```

### 3. Run a local 3-node network (3 terminals)
```bash
# Terminal 1 — first node (genesis)
npm run node1

# Terminal 2 — second node, connects to node 1
npm run node2

# Terminal 3 — third node, connects to both
npm run node3
```

---

## API Reference

### Chain
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Node info + chain status |
| GET | `/chain` | Full blockchain |
| GET | `/chain/latest` | Latest block |
| GET | `/chain/validate` | Verify chain integrity |

### Transactions
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/mempool` | — | Pending transactions |
| POST | `/transaction` | `{from, to, amount, type?, stealth?}` | Add transaction |

### Block Proposal (PoS)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/block/propose` | Auto-select validator by stake |
| POST | `/block/propose/:address` | Propose block as specific validator |

### Validators
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/validators` | — | All validators + stake |
| POST | `/validators/register` | `{address, name, stake}` | Register as validator |

### Wallets
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/wallet/:address` | — | Get balance |
| POST | `/wallet/fund` | `{address, amount}` | Dev faucet (remove in prod!) |

### Supply Chain
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/products` | — | All registered products |
| GET | `/products/:id` | — | Product + full history |
| POST | `/products` | `{ownerAddress, name, batch, origin}` | Register product |
| POST | `/products/:id/transfer` | `{fromAddress, toAddress, location, status, note}` | Transfer ownership |

### Governance
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/governance` | — | All proposals |
| POST | `/governance/propose` | `{validatorAddress, title, description}` | Create proposal |
| POST | `/governance/:id/vote` | `{validatorAddress, choice: "yes"/"no"}` | Cast vote |

### Network
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/peers` | — | Connected peer count |
| POST | `/peers` | `{url}` | Connect to peer (e.g. `ws://1.2.3.4:6001`) |

---

## Example Walkthrough

```bash
# 1. Check node status
curl http://localhost:3001/

# 2. Send a transaction
curl -X POST http://localhost:3001/transaction \
  -H "Content-Type: application/json" \
  -d '{"from":"0xALICE","to":"0xBOB","amount":50,"type":"transfer"}'

# 3. Propose a block (PoS auto-selects validator)
curl -X POST http://localhost:3001/block/propose

# 4. Register a supply chain product
curl -X POST http://localhost:3001/products \
  -H "Content-Type: application/json" \
  -d '{"ownerAddress":"0xFARMS","name":"Arabica Coffee","batch":"LOT-001","origin":"Colombia"}'

# 5. Transfer the product
curl -X POST http://localhost:3001/products/PRD-ABC123/transfer \
  -H "Content-Type: application/json" \
  -d '{"fromAddress":"0xFARMS","toAddress":"0xCARGO","location":"Bogota Airport","status":"In transit","note":"Customs cleared"}'

# 6. Create a governance proposal
curl -X POST http://localhost:3001/governance/propose \
  -H "Content-Type: application/json" \
  -d '{"validatorAddress":"0xVALIDATOR","title":"Reduce fees","description":"Lower tx fee to 0.1 STAN"}'
```

---

## Deploying to Production

### Option A — Private validator network (recommended for supply chain)

1. **Provision servers** — one VPS per validator partner (DigitalOcean, AWS, etc.)
2. **Install Node.js 18+** on each server
3. **Open ports** — 3001 (HTTP API) and 6001 (P2P)
4. **Run with PM2** to keep the node alive:
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name stanimal-node
   pm2 save
   pm2 startup
   ```
5. **Connect nodes** — on each node set the `PEERS` env var:
   ```bash
   PEERS=ws://node1-ip:6001,ws://node2-ip:6001 HTTP_PORT=3001 P2P_PORT=6001 pm2 start src/index.js
   ```

### Option B — Public network

1. Complete all of Option A
2. Add a block explorer frontend (connect it to your `/chain` endpoint)
3. Run a security audit on the node code
4. Remove the `/wallet/fund` faucet endpoint
5. Deploy a public RPC endpoint behind nginx with HTTPS

---

## Project Structure

```
stanimal-chain/
├── src/
│   ├── index.js              # Entry point — boots node, seeds wallets
│   ├── chain/
│   │   ├── Block.js          # Block structure + SHA-256 hashing
│   │   └── Blockchain.js     # PoS, token economics, contracts, governance
│   ├── network/
│   │   └── p2p.js            # WebSocket P2P networking
│   ├── api/
│   │   └── api.js            # REST API (Express)
│   └── wallet/
│       └── wallet.js         # Wallet generation
└── package.json
```

---

## Token Economics

| Parameter | Value |
|-----------|-------|
| Name | STAN |
| Max Supply | 21,000,000 |
| Initial Block Reward | 50 STAN |
| Halving Interval | Every 100 blocks |
| Min Validator Stake | 10 STAN |

---

## Next Steps to Production-Grade

- [ ] Replace address generation with real secp256k1 keypairs + digital signatures
- [ ] Add transaction signature verification
- [ ] Persistent storage (LevelDB or SQLite) so chain survives restarts
- [ ] Longer chain fork resolution (full chain sync)
- [ ] Rate limiting on the API
- [ ] HTTPS + authentication for validator API endpoints
- [ ] Block explorer UI
