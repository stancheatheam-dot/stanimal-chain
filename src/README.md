# Stanimal Chain

Proof of Stake supply chain blockchain with STAN token, stealth addresses, and on-chain governance.

## Quick Start

### Install dependencies
npm install

### Run a single node
npm start

API → http://localhost:3001
P2P → ws://localhost:6001

## API Endpoints

GET  /                        - Node status
GET  /chain                   - Full blockchain
GET  /chain/latest            - Latest block
GET  /chain/validate          - Verify chain integrity
GET  /mempool                 - Pending transactions
POST /transaction             - Add transaction
POST /block/propose           - Propose new block
GET  /validators              - All validators
POST /validators/register     - Register as validator
GET  /wallet/:address         - Get balance
POST /wallet/fund             - Fund a wallet
GET  /products                - All products
GET  /products/:id            - Product + history
POST /products                - Register product
POST /products/:id/transfer   - Transfer ownership
GET  /governance              - All proposals
POST /governance/propose      - Create proposal
POST /governance/:id/vote     - Cast vote
GET  /peers                   - Connected peers
POST /peers                   - Connect to peer

## Token Economics

Max Supply:        21,000,000 STAN
Initial Reward:    50 STAN per block
Halving Interval:  Every 100 blocks
Min Validator Stake: 10 STAN
