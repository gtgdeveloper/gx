const fs = require("fs");
const path = require("path");
const {
  getOrCreateAssociatedTokenAccount,
  burnChecked,
  getMint,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} = require("@solana/spl-token");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");

// --- ENV ---
const secretArray = JSON.parse(process.env.BURNER_KEY || "[]");
if (!secretArray.length) {
  console.error("❌ BURNER_KEY missing (cron env)."); process.exit(1);
}
const wallet = Keypair.fromSecretKey(new Uint8Array(secretArray));

// --- RPC ---
const RPC = "https://warmhearted-cold-log.solana-mainnet.quiknode.pro/53a086ac9192edaca7a3a127b5724abef936e6aa/"

";
const connection = new Connection(RPC, { commitment: "finalized" });

// --- SETTINGS ---
const GTG_MINT = new PublicKey("4nm1ksSbynirCJoZcisGTzQ7c3XBEdxQUpN9EPpemoon");
// Use a STRING to avoid float math:
const HUMAN_AMOUNT = "1000000"; // tokens
const logDir = path.join(__dirname, "data");
const logPath = path.join(logDir, "burn-log.json");

// Helpers
function toBaseUnits(amountStr, decimals) {
  const [i, f = ""] = amountStr.split(".");
  const fpad = (f + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(i || "0") * (10n ** BigInt(decimals)) + BigInt(fpad || "0");
}

(async () => {
  try {
    // Detect mint program & decimals
    let programId = TOKEN_PROGRAM_ID;
    let mintInfo;
    try {
      mintInfo = await getMint(connection, GTG_MINT, "finalized", TOKEN_PROGRAM_ID);
    } catch {
      mintInfo = await getMint(connection, GTG_MINT, "finalized", TOKEN_2022_PROGRAM_ID);
      programId = TOKEN_2022_PROGRAM_ID;
    }
    const DECIMALS = mintInfo.decimals;

    // Get ATA and balances
    const ata = await getOrCreateAssociatedTokenAccount(
      connection, wallet, GTG_MINT, wallet.publicKey, {}, "finalized", programId
    );
    const beforeBal = await connection.getTokenAccountBalance(ata.address, "finalized");
    const beforeUnits = BigInt(beforeBal.value.amount);

    const amt = toBaseUnits(HUMAN_AMOUNT, DECIMALS);
    if (beforeUnits < amt) {
      console.error(`❌ Not enough balance. Have ${Number(beforeUnits)/10**DECIMALS}, need ${HUMAN_AMOUNT}`);
      process.exit(1);
    }

    console.log(`🔥 Burning ${HUMAN_AMOUNT} (program: ${programId.toBase58()}, decimals: ${DECIMALS})`);
    const sig = await burnChecked(
      connection,
      wallet,           // payer
      ata.address,      // token account
      GTG_MINT,         // mint
      wallet,           // owner
      amt,              // bigint
      DECIMALS,
      undefined,        // multiSigners
      undefined,        // confirmOptions
      programId
    );
    console.log("✅ Sent:", sig);
    await connection.confirmTransaction(sig, "finalized");
    console.log("✅ Finalized:", sig);

    // Verify by reading ATA & supply AFTER finalization
    const afterBal = await connection.getTokenAccountBalance(ata.address, "finalized");
    const supply = await connection.getTokenSupply(GTG_MINT, "finalized");
    const afterUnits = BigInt(afterBal.value.amount);
    const outstanding = Number(supply.value.amount) / 10 ** DECIMALS;

    console.log(`📉 Account delta: ${(Number(beforeUnits-afterUnits)/10**DECIMALS).toString()} tokens`);
    console.log(`📦 Supply now: ${outstanding}`);

    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const entry = { time: new Date().toISOString(), amount: Number(HUMAN_AMOUNT), tx: sig, outstanding, programId: programId.toBase58(), decimals: DECIMALS };
    let log = [];
    if (fs.existsSync(logPath)) { try { log = JSON.parse(fs.readFileSync(logPath, "utf8")) || []; } catch {} }
    log.push(entry);
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
    console.log("📝 Logged to", logPath);
  } catch (err) {
    console.error("🔥 Burn failed:", err?.message || err);
    if (err?.logs) console.error("🔎 Program logs:\n" + err.logs.join("\n"));
    process.exit(1);
  }
})();
