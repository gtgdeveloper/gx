const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const { getOrCreateAssociatedTokenAccount, transfer } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

const RPC = "https://bold-powerful-film.solana-mainnet.quiknode.pro/3e3c22206acbd0918412343760560cbb96a4e9e4";
const connection = new Connection(RPC, "confirmed");
const MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

const HOLDERS_FILE = path.join(__dirname, "data", "gtg-holders.json");
const BONUS_LOG_FILE = path.join(__dirname, "bonus-log.json");
const BONUS_FAILED_FILE = path.join(__dirname, "bonus-failed.json");

const secretArray = JSON.parse(process.env.BURNER_KEY);
const wallet = Keypair.fromSecretKey(new Uint8Array(secretArray));

const prizes = [
  { rank: 1, amount: 1.0 },
  { rank: 2, amount: 1.0 },
  { rank: 3, amount: 0.5 },
  { rank: 4, amount: 0.357 },
  { rank: 5, amount: 0.357 },
  { rank: 6, amount: 0.357 },
  { rank: 7, amount: 0.357 },
  { rank: 8, amount: 0.357 },
  { rank: 9, amount: 0.357 },
  { rank: 10, amount: 0.357 }
];

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function hasUsdcTokenAccount(ownerPubkey) {
  try {
    const accounts = await connection.getTokenAccountsByOwner(ownerPubkey, {
      mint: MINT,
    });
    return accounts.value.length > 0;
  } catch {
    return false;
  }
}

(async () => {
  let holders = JSON.parse(fs.readFileSync(HOLDERS_FILE));
  console.log(`🔍 Checking ${holders.length} holders for valid USDC accounts...`);

  // Filter to only those who can receive USDC
  const validHolders = [];
  for (const h of holders) {
  try {
    const pubkey = new PublicKey(h.owner);
    if (await hasUsdcTokenAccount(pubkey)) {
      validHolders.push(h);
    }
  } catch (e) {
    // skip invalid pubkey
  }

  // Add delay to avoid RPC rate limits
  await delay(200);
}


  console.log(`✅ Found ${validHolders.length} eligible holders`);

  // Shuffle and pick top 10
  const winners = shuffle(validHolders).slice(0, 10);

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

      const amountInUSDC = Math.round(amount * 1_000_000);

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

    // Delay 5 seconds between transfers
    await delay(5000);
  }

  fs.writeFileSync(BONUS_LOG_FILE, JSON.stringify(log, null, 2));
  fs.writeFileSync(BONUS_FAILED_FILE, JSON.stringify(failed, null, 2));
  console.log("✅ Bonus winners saved to bonus-log.json");
  console.log("⚠️ Failed transfers saved to bonus-failed.json");
})();
