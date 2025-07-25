
const https = require("https");

async function fetchHoldersFromGitHub(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      });
    }).on("error", reject);
  });
}

const HOLDERS_URL = "https://raw.githubusercontent.com/gtgdeveloper/gx/main/gtg-holders.json";

const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const { getOrCreateAssociatedTokenAccount, transfer } = require("@solana/spl-token");
const fs = require("fs") // fs retained if used elsewhere;
const path = require("path");

// Setup RPC and constants
const RPC = "https://bold-powerful-film.solana-mainnet.quiknode.pro/3e3c22206acbd0918412343760560cbb96a4e9e4";
const connection = new Connection(RPC, "confirmed");
const MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

const BONUS_LOG_FILE = path.join(__dirname, "bonus-log.json");
const BONUS_FAILED_FILE = path.join(__dirname, "bonus-failed.json");

// Load secret key from env and create wallet
const secretArray = JSON.parse(process.env.BURNER_KEY);
const wallet = Keypair.fromSecretKey(new Uint8Array(secretArray));

// Define prizes
const prizes = [
  { rank: 1, amount: 0.1 },
  { rank: 2, amount: 0.1 },
  { rank: 3, amount: 0.1 },
  { rank: 4, amount: 0.1 },
  { rank: 5, amount: 0.357 },
  { rank: 6, amount: 0.357 },
  { rank: 7, amount: 0.357 },
  { rank: 8, amount: 0.357 },
  { rank: 9, amount: 0.357 },
  { rank: 10, amount: 0.357 }
];

// Shuffle array (Fisher-Yates)
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Delay utility
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function
(async () => {
  // Load all holders
  let holders = await fetchHoldersFromGitHub(HOLDERS_URL);
  console.log(`🔍 Loaded ${holders.length} holders`);

  // Shuffle and pick top 10
  const winners = shuffle(holders).slice(0, 10);

  const log = [];
  const failed = [];

  const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet,
    MINT,
    wallet.publicKey
  );

  const balance = await connection.getTokenAccountBalance(senderTokenAccount.address);
  console.log("💰 Sender USDC balance:", balance.value.uiAmountString);

  for (let i = 0; i < prizes.length; i++) {
    const { rank, amount } = prizes[i];
    const recipient = winners[i]?.owner;

    try {
      const recipientPubkey = new PublicKey(recipient);

      const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet,
        MINT,
        recipientPubkey
      );

      const amountInUSDC = Math.round(amount * 1_000_000); // Convert to micro units

      const sig = await transfer(
        connection,
        wallet,
        senderTokenAccount.address,
        recipientTokenAccount.address,
        wallet.publicKey,
        amountInUSDC
      );

      console.log(`✅ Sent ${amount} USDC to ${recipient} (rank ${rank}) | Tx: ${sig}`);
      log.push({
        timestamp: new Date().toISOString(),
        rank,
        recipient,
        amount,
        tx: sig,
        status: "success"
      });
    } catch (error) {
      console.error(`❌ Failed to send ${amount} USDC to ${recipient}: ${error.message || error}`);
      failed.push({
        timestamp: new Date().toISOString(),
        rank,
        recipient,
        amount,
        error: error.message || error.toString()
      });
    }

    // Wait 5 seconds between each transfer
    await delay(5000);
  }

  // Save logs
  fs.writeFileSync(BONUS_LOG_FILE, JSON.stringify(log, null, 2));
  fs.writeFileSync(BONUS_FAILED_FILE, JSON.stringify(failed, null, 2));
  console.log("✅ Bonus winners saved to bonus-log.json");
  console.log("⚠️ Failed transfers saved to bonus-failed.json");
})();
