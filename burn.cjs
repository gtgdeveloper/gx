
/const { getOrCreateAssociatedTokenAccount, burn } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");

// Load from environment
const secretArray = JSON.parse(process.env.BURNER_KEY);
const keypair = Keypair.fromSecretKey(new Uint8Array(secretArray));

const RPC = "https://bold-powerful-film.solana-mainnet.quiknode.pro/3e3c22206acbd0918412343760560cbb96a4e9e4";
const connection = new Connection(RPC, "confirmed");

// === USER SETTINGS ===
const wallet = keypair;
const GTG_MINT = new PublicKey("4nm1ksSbynirCJoZcisGTzQ7c3XBEdxQUpN9EPpemoon");
const AMOUNT_TO_BURN = 1666.67 * 1e9;
const burnLogPath = path.join(__dirname, "data", "burn-log.json");

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

    const newEntry = {
      time: new Date().toISOString(),
      amount: AMOUNT_TO_BURN / 1e9,
      tx: sig,
      outstanding: newOutstanding
    };

    let existingLog = [];
    if (fs.existsSync(burnLogPath)) {
      try {
        existingLog = JSON.parse(fs.readFileSync(burnLogPath));
        if (!Array.isArray(existingLog)) existingLog = [];
      } catch {
        existingLog = [];
      }
    }

    existingLog.push(newEntry);
    fs.writeFileSync(burnLogPath, JSON.stringify(existingLog, null, 2));
    console.log("📝 Burn logged to /data/burn-log.json");
  } catch (err) {
    console.error("🔥 Burn failed:", err);
  }
}

// Run immediately, then every 4 hours
main();
setInterval(main, 14400 * 1000); // 4 hours in milliseconds
