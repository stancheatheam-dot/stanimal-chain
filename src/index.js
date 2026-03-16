const { Blockchain }     = require('./chain/Blockchain');
const { P2PNetwork }     = require('./network/p2p');
const { createAPI }      = require('./api/api');
const { generateWallet } = require('./wallet/wallet');

const HTTP_PORT = parseInt(process.env.HTTP_PORT) || 3001;
const P2P_PORT  = parseInt(process.env.P2P_PORT)  || 6001;
const PEERS     = process.env.PEERS ? process.env.PEERS.split(',') : [];

const blockchain = new Blockchain();
const p2p        = new P2PNetwork(blockchain, P2P_PORT);
const api        = createAPI(blockchain, p2p);

const seedWallets = [
  generateWallet('Alice'),
  generateWallet('Bob'),
  generateWallet('CargoLogix'),
  generateWallet('FreshFarms'),
];

seedWallets.forEach((w) => {
  blockchain.credit(w.address, 1000);
  console.log(`[Seed] Wallet ${w.name}: ${w.address}  (balance: 1000 STAN)`);
});

try {
  blockchain.registerValidator(seedWallets[2].address, 'CargoLogix Node', 500);
  blockchain.registerValidator(seedWallets[3].address, 'FreshFarms Node', 300);
} catch (e) {
  console.warn('[Seed] Validator registration skipped:', e.message);
}

api.listen(HTTP_PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║        STANIMAL CHAIN NODE               ║
  ║  HTTP API → http://localhost:${HTTP_PORT}      ║
  ║  P2P      → ws://localhost:${P2P_PORT}         ║
  ╚══════════════════════════════════════════╝
  `);
});

p2p.listen();

if (PEERS.length) {
  console.log(`[P2P] Connecting to peers: ${PEERS.join(', ')}`);
  p2p.connectToPeers(PEERS);
}

process.on('SIGINT', () => {
  console.log('\n[Node] Shutting down Stanimal Chain node...');
  process.exit(0);
});
