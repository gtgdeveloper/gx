// burn-akio.cjs
// AKIO burn script — burns BURN_AMOUNT tokens each time it runs,
// logs before/after mint supply, and posts to Telegram (optional).

const fs = require("fs");
const path = require("path");
const {
  getOrCreateAssociatedTokenAccount,
  burnChecked,
  getMint,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} = require("@solana/spl-token");
const { Connection, Keypair, PublicKey, clusterApiUrl } = require("@solana/web3.js");

// Optional: load .env if running locally
try {
  require("dotenv").config();
} catch (_) {}

// --- ENV ---
const secretArray = JSON.parse(process.env.BURNER_KEY || "[]");
if (!secretArray.length) {
  console.error("❌ BURNER_KEY missing (array of numbers).");
  process.exit(1);
}

const RPC_URL = process.env.RPC_URL || clusterApiUrl("mainnet-beta");
const TOKEN_MINT_STR = process.env.TOKEN_MINT || "";
const BURN_AMOUNT_UI = Number(process.env.BURN_AMOUNT || "0"); // tokens in UI (e.g. 1000)

// Optional manual overrides
const TOKEN_DECIMALS_ENV = process.env.TOKEN_DECIMALS;
const TOKEN_PROGRAM_ENV = (process.env.TOKEN_PROGRAM || "").toUpperCase(); // "TOKEN" or "TOKEN_2022"

// Telegram (optional)
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TG_CHAT_ID || "";

// sanity checks
if (!TOKEN_MINT_STR) {
  console.error("❌ TOKEN_MINT missing.");
  process.exit(1);
}
if (!BURN_AMOUNT_UI || BURN_AMOUNT_UI <= 0) {
  console.error("❌ BURN_AMOUNT missing or <= 0 (set BURN_AMOUNT=1000 to burn 1,000 tokens).");
  process.exit(1);
}

// --- Helpers ---

/**
 * Format a BigInt amount with decimals into a human string.
 * Example: 200000000000n, decimals=6 -> "200000.000000"
 */
function formatAmount(amountBigInt, decimals) {
  const negative = amountBigInt < 0n;
  let s = amountBigInt.toString();
  if (negative) s = s.slice(1);
  if (decimals === 0) return (negative ? "-" : "") + s;

  if (s.length <= decimals) {
    const padded = s.padStart(decimals + 1, "0");
    const intPart = padded.slice(0, padded.length - decimals);
    const fracPart = padded.slice(padded.length - decimals);
    return (negative ? "-" : "") + intPart + "." + fracPart;
  }

  const intPart = s.slice(0, s.length - decimals);
  const fracPart = s.slice(s.length - decimals);
  return (negative ? "-" : "") + intPart + "." + fracPart;
}

function formatTorontoTime() {
  const now = new Date();
  try {
    return now.toLocaleString("en-CA", {
      timeZone: "America/Toronto",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return now.toISOString();
  }
}

async function sendTelegramMessage(text) {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
    console.log("ℹ️ Telegram not configured (TG_BOT_TOKEN / TG_CHAT_ID missing). Skipping TG message.");
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text,
        parse_mode: "Markdown",
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("⚠️ Telegram sendMessage error:", data);
    } else {
      console.log("📨 Telegram message sent.");
    }
  } catch (err) {
    console.error("⚠️ Telegram sendMessage failed:", err?.message || err);
  }
}

// --- Setup ---
const connection = new Connection(RPC_URL, "confirmed");
const wallet = Keypair.fromSecretKey(Uint8Array.from(secretArray));
const mintPubkey = new PublicKey(TOKEN_MINT_STR);

// log file setup
const logDir = path.join(__dirname, "logs");
const logPath = path.join(logDir, "burn-akio.json");

(async () => {
  console.log("🔗 RPC_URL:", RPC_URL);
  console.log("👛 Burner wallet:", wallet.publicKey.toBase58());
  console.log("🪙 Mint:", mintPubkey.toBase58());
  console.log("🔥 Requested burn (UI):", BURN_AMOUNT_UI);

  try {
    let programId;
    let DECIMALS;

    // --- 1) Prefer manual config from .env if provided ---
    if (TOKEN_DECIMALS_ENV !== undefined && TOKEN_DECIMALS_ENV !== "") {
      DECIMALS = Number(TOKEN_DECIMALS_ENV);
      if (Number.isNaN(DECIMALS) || DECIMALS < 0 || DECIMALS > 12) {
        console.error("❌ Invalid TOKEN_DECIMALS in .env:", TOKEN_DECIMALS_ENV);
        process.exit(1);
      }

      if (TOKEN_PROGRAM_ENV === "TOKEN_2022") {
        programId = TOKEN_2022_PROGRAM_ID;
        console.log("⚙️ Using manual config: TOKEN_PROGRAM = TOKEN_2022");
      } else {
        programId = TOKEN_PROGRAM_ID;
        console.log("⚙️ Using manual config: TOKEN_PROGRAM = TOKEN (classic SPL)");
      }

      console.log("⚙️ Using manual TOKEN_DECIMALS =", DECIMALS);
    } else {
      // --- 2) Fallback: try auto-detect via RPC ---
      console.log("ℹ️ No TOKEN_DECIMALS in env, trying to auto-detect via RPC...");

      let mintInfo;

      try {
        mintInfo = await getMint(connection, mintPubkey, "confirmed", TOKEN_PROGRAM_ID);
        programId = TOKEN_PROGRAM_ID;
        console.log("✅ Using TOKEN_PROGRAM_ID (SPL Token).");
      } catch (e1) {
        console.log("ℹ️ TOKEN_PROGRAM_ID failed, trying TOKEN_2022_PROGRAM_ID...");
        try {
          mintInfo = await getMint(connection, mintPubkey, "confirmed", TOKEN_2022_PROGRAM_ID);
          programId = TOKEN_2022_PROGRAM_ID;
          console.log("✅ Using TOKEN_2022_PROGRAM_ID.");
        } catch (e2) {
          console.error("❌ Failed to load mint with either TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID");
          console.error("   e1:", e1?.message || e1);
          console.error("   e2:", e2?.message || e2);
          process.exit(1);
        }
      }

      DECIMALS = mintInfo.decimals;
      console.log("🔢 Mint decimals (auto):", DECIMALS);
    }

    // --- Fetch mint supply BEFORE burn ---
    let supplyBeforeBase = null;
    try {
      const mintInfoBefore = await getMint(connection, mintPubkey, "confirmed", programId);
      supplyBeforeBase = mintInfoBefore.supply; // BigInt
      console.log("🏦 Mint total supply BEFORE (base units):", supplyBeforeBase.toString());
    } catch (e) {
      console.error("⚠️ Failed to fetch mint supply before burn:", e?.message || e);
    }

    // --- Amount in base units (u64 bigint) ---
    const amountBaseUnits = BigInt(Math.floor(BURN_AMOUNT_UI * 10 ** DECIMALS));
    if (amountBaseUnits <= 0n) {
      console.error("❌ Calculated burn amount in base units is 0. Check BURN_AMOUNT and decimals.");
      process.exit(1);
    }

    // --- Get or create ATA ---
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      mintPubkey,
      wallet.publicKey,
      false,
      "confirmed",
      { commitment: "confirmed" },
      programId
    );

    const currentAmount = ata.amount; // bigint in base units
    console.log("💰 Current burner wallet balance (base units):", currentAmount.toString());

    if (currentAmount < amountBaseUnits) {
      console.error("❌ Not enough balance to burn.");
      console.error("   Required:", amountBaseUnits.toString());
      console.error("   Have    :", currentAmount.toString());
      process.exit(1);
    }

    // --- Burn ---
    console.log("🔥 Burning", BURN_AMOUNT_UI, "tokens...");

    const txSig = await burnChecked(
      connection,
      wallet,
      ata.address,      // token account (ATA)
      mintPubkey,       // mint
      wallet.publicKey, // owner
      amountBaseUnits,  // bigint in base units
      DECIMALS,         // must equal mint.decimals
      [],
      { commitment: "confirmed" },
      programId
    );

    console.log("✅ Burn successful!");
    console.log("🧾 Tx signature:", txSig);

    // --- Compute/Fetch mint supply AFTER burn ---
    let supplyAfterBase = null;
    if (supplyBeforeBase !== null) {
      supplyAfterBase = supplyBeforeBase - amountBaseUnits;
      console.log("🏦 Mint total supply AFTER (computed, base units):", supplyAfterBase.toString());
    } else {
      try {
        const mintInfoAfter = await getMint(connection, mintPubkey, "confirmed", programId);
        supplyAfterBase = mintInfoAfter.supply;
        console.log("🏦 Mint total supply AFTER (fetched, base units):", supplyAfterBase.toString());
      } catch (e) {
        console.error("⚠️ Failed to fetch mint supply after burn:", e?.message || e);
      }
    }

    // --- Fetch remaining burner wallet balance for log ---
    const refreshedAta = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      mintPubkey,
      wallet.publicKey,
      false,
      "confirmed",
      { commitment: "confirmed" },
      programId
    );

    const remainingBaseUnits = refreshedAta.amount;
    const remainingUi = Number(remainingBaseUnits) / 10 ** DECIMALS;

    // --- Prepare Telegram message ---
    const whenStr = formatTorontoTime();
    const solscanUrl = `https://solscan.io/tx/${txSig}`;

    let beforeUiStr = supplyBeforeBase !== null ? formatAmount(supplyBeforeBase, DECIMALS) : "unknown";
    let afterUiStr = supplyAfterBase !== null ? formatAmount(supplyAfterBase, DECIMALS) : "unknown";
    const burnUiStr = BURN_AMOUNT_UI.toLocaleString("en-US");

    const tgText =
      `📉 *AKIO Burn Update*\n\n` +
      `${whenStr} (Toronto)\n\n` +
      `Tokens outstanding *before* burn: \`${beforeUiStr}\`\n` +
      `We are now burning *${burnUiStr}* AKIO.\n\n` +
      `✅ Burning complete.\n` +
      `[View on Solscan](${solscanUrl})\n\n` +
      `New tokens outstanding: \`${afterUiStr}\``;

    await sendTelegramMessage(tgText);

    // --- Log to JSON file ---
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const entry = {
      time: new Date().toISOString(),
      prettyTimeToronto: whenStr,
      tx: txSig,
      solscanUrl,
      mint: mintPubkey.toBase58(),
      owner: wallet.publicKey.toBase58(),
      programId: programId.toBase58(),
      decimals: DECIMALS,
      burnUi: BURN_AMOUNT_UI,
      burnBaseUnits: amountBaseUnits.toString(),
      mintSupplyBeforeBase: supplyBeforeBase !== null ? supplyBeforeBase.toString() : null,
      mintSupplyAfterBase: supplyAfterBase !== null ? supplyAfterBase.toString() : null,
      remainingUi,
      remainingBaseUnits: remainingBaseUnits.toString(),
    };

    let log = [];
    if (fs.existsSync(logPath)) {
      try {
        log = JSON.parse(fs.readFileSync(logPath, "utf8")) || [];
      } catch {
        log = [];
      }
    }
    log.push(entry);
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

    console.log("📝 Logged to", logPath);
  } catch (err) {
    console.error("🔥 Burn failed:", err?.message || err);
    if (err?.logs) console.error("🔎 Program logs:\n" + err.logs.join("\n"));
    process.exit(1);
  }
})();

