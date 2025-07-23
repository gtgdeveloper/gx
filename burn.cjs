
// burn.cjs — burns 10 GTG every minute using real token supply

const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const { getOrCreateAssociatedTokenAccount, burn } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

const RPC = "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC, "confirmed");

// === USER SETTINGS ===
const secretKey = Uint8Array.from([
  125, 47, 49, 21, 223, 179, 32, 161, 137, 165, 172, 215, 179, 185, 100, 217,
  199, 251, 216, 5, 36, 245, 205, 150, 41, 230, 234, 143, 32, 240, 34, 183,
  156, 24, 242, 156, 168, 75, 189, 7, 43, 39, 181, 105, 61, 42, 68, 128,
  28, 199, 107, 56, 212, 95, 163, 215, 85, 117, 233, 7, 132, 16, 119, 25
]);
const wallet = Keypair.fromSecretKey(secretKey);
const GTG_MINT = new PublicKey("4nm1ksSbynirCJoZcisGTzQ7c3XBEdxQUpN9EPpemoon");
const AMOUNT_TO_BURN = 10 * 1e9;

async function main() {
  try {
    console.log("\n📡 Connecting to Solana...");
    const ata = await getOrCreateAssociatedTokenAccount(connection, wallet, GTG_MINT, wallet.publicKey);

    const balanceInfoBefore = await connection.getTokenAccountBalance(ata.address);
    const balanceBefore = parseFloat(balanceInfoBefore.value.amount);

    if (balanceBefore < AMOUNT_TO_BURN) {
      console.error(`❌ Not enough GTG to burn. Available: ${balanceBefore / 1e9}, Required: ${AMOUNT_TO_BURN / 1e9}`);
      return;
    }

    console.log(`🔥 Burning ${AMOUNT_TO_BURN / 1e9} GTG from ${ata.address.toBase58()}`);

    const sig = await burn(
      connection,
      wallet,
      ata.address,
      GTG_MINT,
      wallet,
      AMOUNT_TO_BURN
    );

    console.log("✅ Burn transaction sent:", sig);

    await new Promise(r => setTimeout(r, 3000)); // Wait for Solana to update supply

    const supplyInfo = await connection.getTokenSupply(GTG_MINT);
    const newOutstanding = parseFloat(supplyInfo.value.amount) / 1e9;

    console.log(`📦 GTG Token Supply after burn: ${newOutstanding.toLocaleString("en-US", { maximumFractionDigits: 9 })}`);

    const burnLog = {
      time: new Date().toISOString(),
      amount: AMOUNT_TO_BURN / 1e9,
      tx: sig,
      outstanding: newOutstanding
    };

    fs.writeFileSync(path.join(__dirname, "burn-log.json"), JSON.stringify(burnLog, null, 2));
    console.log("📝 Burn logged to burn-log.json");
  } catch (err) {
    console.error("🔥 Burn failed:", err);
  }
}

// Run immediately, then every 60 seconds
main();
setInterval(main, 60 * 1000);
