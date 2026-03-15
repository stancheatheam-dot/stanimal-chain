const { Blockchain }     = require('./chain/Blockchain');
const { P2PNetwork }     = require('./network/p2p');
const { createAPI }      = require('./api/api');
const { generateWallet } = require('./wallet/wallet');
const { Database }       = require('./db/Database');

const HTTP_PORT = parseInt(process.env.HTTP_PORT) || 3001;
const P2P_PORT  = parseInt(process.env.P2P_PORT)  || 6001;
const PEERS     = process.env.PEERS ? process.env.PEERS.split(',') : [];
const DB_PATH   = process.env.DB_PATH || './data/stanimal-db';

async function main() {
  const blockchain = new Blockchain();
  const db         = new Database(DB_PATH);
  const p2p        = new P2PNetwork(blockchain, P2P_PORT);

  await db.open();
  const restored = await db.restoreBlockchain(blockchain);

  if (!restored) {
    const seedWallets = [
      generateWallet('Alice'),
      generateWallet('Bob'),
      generateWallet('CargoLogix'),
      generateWallet('FreshFarms'),
    ];
    seedWallets.forEach((w) => {
      blockchain.credit(w.address, 1000);
      console.log(`[Seed] ${w.name}: ${w.address}  (1000 STAN)`);
    });
    try {
      blockchain.registerValidator(seedWallets[2].address, 'CargoLogix Node', 500);
      blockchain.registerValidator(seedWallets[3].address, 'FreshFarms Node',  300);
    } catch (e) {
      console.warn('[Seed] Validator setup skipped:', e.message);
    }
    await db.saveBlock(blockchain.chain[0]);
    await db.saveState(blockchain);
  }

  // Patch proposeBlock to auto-save after every block
  const _propose = blockchain.proposeBlock.bind(blockchain);
  blockchain.proposeBlock = function(validatorAddress) {
    const block = _propose(validatorAddress);
    db.saveAll(blockchain).catch(console.error);
    return block;
  };

  const app = createAPI(blockchain, p2p);

  app.listen(HTTP_PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════════════╗
  ║          STANIMAL CHAIN NODE                  ║
  ║  API      →  http://localhost:${HTTP_PORT}          ║
  ║  Explorer →  http://localhost:${HTTP_PORT}/explorer ║
  ║  Wallet   →  http://localhost:${HTTP_PORT}/wallet   ║
  ║  P2P      →  ws://localhost:${P2P_PORT}              ║
  ╚═══════════════════════════════════════════════╝
    `);
  });

  p2p.listen();
  if (PEERS.length) p2p.connectToPeers(PEERS);

  process.on('SIGINT', async () => {
    console.log('\n[Node] Saving and shutting down...');
    await db.saveAll(blockchain);
    await db.close();
    process.exit(0);
  });
}

main().catch((err) => { console.error('[Fatal]', err); process.exit(1); });
