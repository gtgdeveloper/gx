// burn1.cjs
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
const BURN_AMOUNT_UI = Number(process.env.BURN_AMOUNT || "0");

// Optional manual overrides
const TOKEN_DECIMALS_ENV = process.env.TOKEN_DECIMALS;
const TOKEN_PROGRAM_ENV = (process.env.TOKEN_PROGRAM || "").toUpperCase();

// Telegram (optional)
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TG_CHAT_ID || "";

// sanity checks
if (!TOKEN_MINT_STR) { console.error("❌ TOKEN_MINT missing."); process.exit(1); }
if (!BURN_AMOUNT_UI || BURN_AMOUNT_UI <= 0) { console.error("❌ Invalid BURN_AMOUNT"); process.exit(1); }

function formatAmount(amountBigInt, decimals) {
  const neg = amountBigInt < 0n;
  let s = amountBigInt.toString();
  if (neg) s = s.slice(1);
  if (decimals === 0) return (neg ? "-" : "") + s;
  if (s.length <= decimals) {
    const padded = s.padStart(decimals + 1, "0");
    return (neg ? "-" : "") + padded.slice(0, -decimals) + "." + padded.slice(-decimals);
  }
  return (neg ? "-" : "") + s.slice(0, -decimals) + "." + s.slice(-decimals);
}

function formatTorontoTime() {
  const now = new Date();
  try {
    return now.toLocaleString("en-CA", {
      timeZone: "America/Toronto",
      weekday: "long", year: "numeric",
      month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch { return now.toISOString(); }
}

async function sendTelegramMessage(text) {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: "Markdown" }),
    });
    const data = await res.json();
    if (!data.ok) console.error("TG error:", data);
  } catch (e) { console.error("TG send failed:", e); }
}

const connection = new Connection(RPC_URL, "confirmed");
const wallet = Keypair.fromSecretKey(Uint8Array.from(secretArray));
const mintPubkey = new PublicKey(TOKEN_MINT_STR);

const logDir = path.join(__dirname, "logs");
const logPath = path.join(logDir, "burn-akio.json");

(async () => {
  console.log("RPC_URL:", RPC_URL);
  console.log("Burner wallet:", wallet.publicKey.toBase58());
  console.log("Mint:", mintPubkey.toBase58());
  console.log("Burn amount:", BURN_AMOUNT_UI);

  let programId, DECIMALS;

  if (TOKEN_DECIMALS_ENV) {
    DECIMALS = Number(TOKEN_DECIMALS_ENV);
    programId = TOKEN_PROGRAM_ENV === "TOKEN_2022" ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  } else {
    let mintInfo;
    try {
      mintInfo = await getMint(connection, mintPubkey, "confirmed", TOKEN_PROGRAM_ID);
      programId = TOKEN_PROGRAM_ID;
    } catch {
      mintInfo = await getMint(connection, mintPubkey, "confirmed", TOKEN_2022_PROGRAM_ID);
      programId = TOKEN_2022_PROGRAM_ID;
    }
    DECIMALS = mintInfo.decimals;
  }

  // Get mint supply BEFORE burn
  let mintBefore = (await getMint(connection, mintPubkey, "confirmed", programId)).supply;

  const ata = await getOrCreateAssociatedTokenAccount(
    connection, wallet, mintPubkey, wallet.publicKey,
    false, "confirmed", { commitment: "confirmed" }, programId
  );

  const burnAmountBase = BigInt(Math.floor(BURN_AMOUNT_UI * 10 ** DECIMALS));

  console.log("Burning...");
  const txSig = await burnChecked(
    connection, wallet, ata.address, mintPubkey, wallet.publicKey,
    burnAmountBase, DECIMALS, [], { commitment: "confirmed" }, programId
  );

  let mintAfter = mintBefore - burnAmountBase;

  const when = formatTorontoTime();
  const solscanUrl = `https://solscan.io/tx/${txSig}`;
  const msg =
    `📉 *AKIO Burn Update*

${when}

` +
    `Before burn: \`${formatAmount(mintBefore, DECIMALS)}\`
` +
    `Burning *${BURN_AMOUNT_UI}* AKIO

` +
    `Tx: [View on Solscan](${solscanUrl})

` +
    `After burn: \`${formatAmount(mintAfter, DECIMALS)}\``;

  await sendTelegramMessage(msg);

  // Log
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(logPath, JSON.stringify({ time: when, tx: txSig }, null, 2));

  console.log("Done:", txSig);
})();
