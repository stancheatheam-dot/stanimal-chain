const WebSocket = require('ws');

const MessageType = {
  QUERY_LATEST:     'QUERY_LATEST',
  QUERY_ALL:        'QUERY_ALL',
  RESPONSE_CHAIN:   'RESPONSE_CHAIN',
  NEW_TRANSACTION:  'NEW_TRANSACTION',
  NEW_BLOCK:        'NEW_BLOCK',
};

class P2PNetwork {
  constructor(blockchain, port) {
    this.blockchain = blockchain;
    this.port       = port;
    this.sockets    = [];           // connected peer sockets
    this.server     = null;
  }

  // Start listening for incoming peer connections
  listen() {
    this.server = new WebSocket.Server({ port: this.port });
    this.server.on('connection', (socket) => this.initSocket(socket));
    console.log(`[P2P] Listening on port ${this.port}`);
  }

  // Connect to a known peer
  connectToPeer(peerUrl) {
    const socket = new WebSocket(peerUrl);
    socket.on('open',  () => {
      this.initSocket(socket);
      console.log(`[P2P] Connected to peer: ${peerUrl}`);
    });
    socket.on('error', (err) => console.error(`[P2P] Failed to connect to ${peerUrl}:`, err.message));
  }

  connectToPeers(peers) {
    peers.forEach((p) => this.connectToPeer(p));
  }

  initSocket(socket) {
    this.sockets.push(socket);

    socket.on('message', (data) => this.handleMessage(socket, data));
    socket.on('close',   () => {
      this.sockets = this.sockets.filter((s) => s !== socket);
      console.log('[P2P] Peer disconnected');
    });
    socket.on('error',   (err) => console.error('[P2P] Socket error:', err.message));

    // Ask the new peer for their latest block
    this.send(socket, { type: MessageType.QUERY_LATEST });
  }

  handleMessage(socket, rawData) {
    try {
      const msg = JSON.parse(rawData);

      switch (msg.type) {

        case MessageType.QUERY_LATEST:
          this.send(socket, {
            type:  MessageType.RESPONSE_CHAIN,
            chain: [this.blockchain.latestBlock],
          });
          break;

        case MessageType.QUERY_ALL:
          this.send(socket, {
            type:  MessageType.RESPONSE_CHAIN,
            chain: this.blockchain.chain,
          });
          break;

        case MessageType.RESPONSE_CHAIN:
          this.handleReceivedChain(msg.chain);
          break;

        case MessageType.NEW_TRANSACTION:
          try {
            this.blockchain.addTransaction(msg.transaction);
            console.log('[P2P] Received new transaction from peer');
          } catch (e) {
            console.warn('[P2P] Rejected transaction from peer:', e.message);
          }
          break;

        case MessageType.NEW_BLOCK:
          this.handleReceivedBlock(msg.block);
          break;
      }
    } catch (e) {
      console.error('[P2P] Bad message:', e.message);
    }
  }

  handleReceivedChain(receivedChain) {
    const latest = receivedChain[receivedChain.length - 1];
    const ourLatest = this.blockchain.latestBlock;

    if (latest.index <= ourLatest.index) return; // we're ahead or equal

    console.log(`[P2P] Peer is ahead (block #${latest.index} vs our #${ourLatest.index})`);

    if (latest.previousHash === ourLatest.hash) {
      // Peer is just one block ahead — add it directly
      console.log('[P2P] Adding single block from peer');
      // (full validation would rebuild state; simplified here)
    } else if (receivedChain.length > this.blockchain.chain.length) {
      // Peer has a longer chain — request the full chain to sync
      console.log('[P2P] Peer has longer chain — requesting full sync');
      this.broadcast({ type: MessageType.QUERY_ALL });
    }
  }

  handleReceivedBlock(blockData) {
    const latest = this.blockchain.latestBlock;
    if (blockData.index > latest.index + 1) {
      // We're behind — ask for the full chain
      this.broadcast({ type: MessageType.QUERY_ALL });
    }
  }

  // Broadcast a new transaction to all peers
  broadcastTransaction(transaction) {
    this.broadcast({ type: MessageType.NEW_TRANSACTION, transaction });
  }

  // Broadcast a newly proposed block to all peers
  broadcastBlock(block) {
    this.broadcast({ type: MessageType.NEW_BLOCK, block });
  }

  broadcast(message) {
    this.sockets.forEach((s) => this.send(s, message));
  }

  send(socket, message) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  get peerCount() {
    return this.sockets.length;
  }
}

module.exports = { P2PNetwork, MessageType };
