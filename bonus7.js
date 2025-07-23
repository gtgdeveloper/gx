
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const { getOrCreateAssociatedTokenAccount, transfer } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

const RPC = "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC, "confirmed");
const MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const HOLDERS_FILE = path.join(__dirname, "gtg-holders.json");
const BONUS_LOG_FILE = path.join(__dirname, "bonus-log.json");
const BONUS_FAILED_FILE = path.join(__dirname, "bonus-failed.json");

const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync("repair.json")));
const wallet = Keypair.fromSecretKey(secretKey);

const prizes = [
  { rank: 1, amount: 5.0 },
  { rank: 2, amount: 2.0 },
  { rank: 3, amount: 0.5 },
  { rank: 4, amount: 0.357 },
  { rank: 5, amount: 0.357 },
  { rank: 6, amount: 0.357 },
  { rank: 7, amount: 0.357 },
  { rank: 8, amount: 0.357 },
  { rank: 9, amount: 0.357 },
  { rank: 10, amount: 0.357 }
];

// Fisher-Yates shuffle
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

(async () => {
  let holders = JSON.parse(fs.readFileSync(HOLDERS_FILE));

  // Shuffle and take the top 10
  holders = shuffle(holders).slice(0, 10);

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
    const recipient = holders[i]?.owner;

    try {
      if (!recipient || typeof recipient !== "string" || recipient.length < 32) {
        throw new Error(`Invalid recipient address at rank ${rank}: ${recipient}`);
      }

      const recipientPubkey = new PublicKey(recipient);

      if (!PublicKey.isOnCurve(recipientPubkey)) {
        throw new Error(`Recipient public key is off-curve (cannot receive SPL tokens)`);
      }

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
      log.push({ rank, recipient, amount, tx: sig });

    } catch (error) {
      console.error(`❌ Failed to send ${amount} USDC to ${recipient}:`);
      console.error(error.message || error);
      failed.push({ rank, recipient, amount, error: error.message || error.toString() });
    }
  }

  fs.writeFileSync(BONUS_LOG_FILE, JSON.stringify(log, null, 2));
  fs.writeFileSync(BONUS_FAILED_FILE, JSON.stringify(failed, null, 2));
  console.log("✅ Bonus winners saved to bonus-log.json");
  console.log("⚠️ Failed transfers saved to bonus-failed.json");
})();
