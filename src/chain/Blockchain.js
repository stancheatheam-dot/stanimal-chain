const Blockchain = require('./chain/Blockchain').Blockchain;
const P2PNetwork = require('./network/p2p').P2PNetwork;
const createAPI = require('./api/api').createAPI;
const generateWallet = require('./wallet/wallet').generateWallet;

const HTTP_PORT = parseInt(process.env.HTTP_PORT) || 3001;
const P2P_PORT = parseInt(process.env.P2P_PORT) || 6001;
const PEERS = process.env.PEERS ? process.env.PEERS.split(',') : [];

const blockchain = new Blockchain();
const p2p = new P2PNetwork(blockchain, P2P_PORT);
const api = createAPI(blockchain, p2p);

const seedWallets = [
  generateWallet('Alice'),
  generateWallet('Bob'),
  generateWallet('CargoLogix'),
  generateWallet('FreshFarms'),
];

seedWallets.forEach(function(w) {
  blockchain.credit(w.address, 1000);
  console.log('[Seed] Wallet ' + w.name + ': ' + w.address);
});

try {
  blockchain.registerValidator(seedWallets[2].address, 'CargoLogix Node', 500);
  blockchain.registerValidator(seedWallets[3].address, 'FreshFarms Node', 300);
} catch (e) {
  console.warn('[Seed] Validator registration skipped: ' + e.message);
}

api.listen(HTTP_PORT, function() {
  console.log('Stanimal Chain is live!');
  console.log('HTTP API: http://localhost:' + HTTP_PORT);
  console.log('P2P: ws://localhost:' + P2P_PORT);
});

p2p.listen();

if (PEERS.length) {
  console.log('[P2P] Connecting to peers: ' + PEERS.join(', '));
  p2p.connectToPeers(PEERS);
}

process.on('SIGINT', function() {
  console.log('Shutting down Stanimal Chain node...');
  process.exit(0);
});
