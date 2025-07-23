const fs = require("fs");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const { getOrCreateAssociatedTokenAccount, transfer } = require("@solana/spl-token");

const RPC_URL = "https://bold-powerful-film.solana-mainnet.quiknode.pro/3e3c22206acbd0918412343760560cbb96a4e9e4";
const connection = new Connection(RPC_URL, "confirmed");

const secretKeyString = process.env.REPAIR_SECRET;
if (!secretKeyString) {
  console.error("❌ Missing REPAIR_SECRET environment variable.");
  process.exit(1);
}

let secretKey;
try {
  secretKey = Uint8Array.from(JSON.parse(secretKeyString));
} catch (e) {
  console.error("❌ Failed to parse REPAIR_SECRET:", e);
  process.exit(1);
}

const wallet = Keypair.fromSecretKey(secretKey);
const GTG_MINT = new PublicKey("4nm1ksSbynirCJoZcisGTzQ7c3XBEdxQUpN9EPpemoon");

(async () => {
  console.log("🚀 Starting GTG airdrop...");

  if (!fs.existsSync("./data/gtg-holders.json")) {
    console.error("❌ Holders file not found.");
    process.exit(1);
  }

  const holders = JSON.parse(fs.readFileSync("./data/gtg-holders.json", "utf8"))
    .filter((h) => h.amount > 20000);

  console.log(`👥 Eligible wallets: ${holders.length}`);

  const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet,
    GTG_MINT,
    wallet.publicKey
  );

  for (const holder of holders) {
    const toWallet = new PublicKey(holder.wallet);
    const amount = Math.floor(holder.amount / 20000); // 1 GTG per 20,000 GTG held

    if (amount <= 0) {
      console.log(`⚠️ Skipping ${holder.wallet}, not enough balance.`);
      continue;
    }

    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      GTG_MINT,
      toWallet
    );

    try {
      const sig = await transfer(
        connection,
        wallet,
        fromTokenAccount.address,
        toTokenAccount.address,
        wallet,
        amount * 1e6 // assuming 6 decimals
      );

      console.log(`✅ Sent ${amount} GTG to ${holder.wallet} [tx: ${sig}]`);
    } catch (e) {
      console.error(`❌ Failed to send to ${holder.wallet}:`, e.message);
    }
  }

  console.log("✅ Airdrop process complete.");
})();
