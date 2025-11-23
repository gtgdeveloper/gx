// burn2.cjs
// AKIO burn + airdrop script.
// - Burns BURN_AMOUNT tokens each run
// - Optionally airdrops AIRDROP_TOTAL_UI tokens to holders between MIN_HOLD_UI and MAX_HOLD_UI
// - Sends two Telegram messages:
//   1) Burn update + supply tracker
//   2) Airdrop summary + per-account distribution + promo footer

const fs = require("fs");
const path = require("path");

const BURN_SCHEDULE_TEXT = `Day   Date        Burn Amount (AKIO)
----  ----------  --------------------
 1    Nov 24      2,000,000
 2    Nov 25      2,000,000
 3    Nov 26      2,000,000
 4    Nov 27      2,000,000
 5    Nov 28      2,000,000
 6    Nov 29      2,000,000
 7    Nov 30      2,000,000

 8    Dec 01      3,000,000
 9    Dec 02      3,000,000
10    Dec 03      3,000,000
11    Dec 04      3,000,000
12    Dec 05      3,000,000
13    Dec 06      3,000,000
14    Dec 07      3,000,000

15    Dec 08      4,000,000
16    Dec 09      4,000,000
17    Dec 10      4,000,000
18    Dec 11      4,000,000
19    Dec 12      4,000,000
20    Dec 13      4,000,000
21    Dec 14      4,000,000

22    Dec 15      6,000,000
23    Dec 16      6,000,000
24    Dec 17      6,000,000
25    Dec 18      6,000,000
26    Dec 19      6,000,000
27    Dec 20      6,000,000
28    Dec 21      6,000,000

29    Dec 22      8,000,000
30    Dec 23      8,000,000
31    Dec 24      8,000,000
32    Dec 25      8,000,000
33    Dec 26      8,000,000
34    Dec 27      8,000,000
35    Dec 28      8,000,000

36    Dec 29      13,000,000
37    Dec 30      13,000,000
38    Dec 31      13,000,000
`;

const {
  getOrCreateAssociatedTokenAccount,
  burnChecked,
  getMint,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  transferChecked,
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

const TOKEN_DECIMALS_ENV = process.env.TOKEN_DECIMALS;
const TOKEN_PROGRAM_ENV = (process.env.TOKEN_PROGRAM || "").toUpperCase();

// Telegram
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TG_CHAT_ID || "";

// Airdrop config
const AIRDROP_TOTAL_UI = Number(process.env.AIRDROP_TOTAL_UI || "0"); // e.g. 50000
const MIN_HOLD_UI = Number(process.env.MIN_HOLD_UI || "0");           // e.g. 10000
const MAX_HOLD_UI = Number(process.env.MAX_HOLD_UI || "0");           // e.g. 20000 (0 = no max)
const AIRDROP_DELAY_MS = Number(process.env.AIRDROP_DELAY_MS || "1500"); // throttle between recipients
const AIRDROP_SECOND_MSG_DELAY_MS = 120000; // 2 minutes

if (!TOKEN_MINT_STR) {
  console.error("❌ TOKEN_MINT missing.");
  process.exit(1);
}
if (!BURN_AMOUNT_UI || BURN_AMOUNT_UI <= 0) {
  console.error("❌ BURN_AMOUNT missing or <= 0.");
  process.exit(1);
}

// --- Helpers ---

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function sendBurnScheduleFileToTelegram() {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
    console.warn("⚠️ TG_BOT_TOKEN or TG_CHAT_ID not set, skipping burn schedule file.");
    return;
  }

  try {
    // Write the file on the fly
    const filePath = "/mnt/data/akio_burn_schedule.txt";  // your created file
    fs.writeFileSync(filePath, BURN_SCHEDULE_TEXT, "utf8");

    // Use Web/Undici FormData (NO getHeaders)
    const form = new FormData();
    form.append("chat_id", TG_CHAT_ID);
    form.append("parse_mode", "Markdown");
    form.append("caption", "📄 *AKIO DAILY BURN SCHEDULE*\n\nDownload the full burn plan.");
    form.append("document", filePath);  // ChatGPT will convert this to a real URL

    const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendDocument`, {
      method: "POST",
      body: form   // ❗ No headers needed
    });

    const data = await res.json();
    if (!data.ok) {
      console.error("❌ Telegram sendDocument error:", data);
    } else {
      console.log("📄 Burn schedule document sent to Telegram.");
    }

  } catch (e) {
    console.error("❌ Telegram sendDocument failed:", e?.message || e);
  }
}




async function sendTelegramMessage(text) {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
    console.log("ℹ️ Telegram not configured; skipping TG.");
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: "Markdown" }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("⚠️ Telegram error:", data);
    } else {
      console.log("📨 Telegram message sent.");
    }
  } catch (e) {
    console.error("⚠️ Telegram send failed:", e?.message || e);
  }
}


async function sendTelegramDocument(filename, content) {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
    console.log("ℹ️ Telegram not configured; skipping TG document.");
    return;
  }
  try {
    const form = new FormData();
    form.append("chat_id", TG_CHAT_ID);
    const blob = new Blob([content], { type: "text/plain" });
    form.append("document", blob, filename);

    const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendDocument`, {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("⚠️ Telegram document error:", data);
    } else {
      console.log("📄 Telegram document sent.");
    }
  } catch (e) {
    console.error("⚠️ Telegram document send failed:", e?.message || e);
  }
}


async function sendTelegramVideo(filename, caption) {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
    console.log("ℹ️ Telegram not configured; skipping TG video.");
    return;
  }
  const videoPath = path.join(__dirname, filename);
  if (!fs.existsSync(videoPath)) {
    console.log("ℹ️ Video file not found, skipping:", videoPath);
    return;
  }
  try {
    const data = await fs.promises.readFile(videoPath);
    const form = new FormData();
    form.append("chat_id", TG_CHAT_ID);
    const blob = new Blob([data], { type: "video/mp4" });
    form.append("video", blob, filename);
    if (caption) {
      form.append("caption", caption);
    }

    const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendVideo`, {
      method: "POST",
      body: form,
    });
    const resp = await res.json();
    if (!resp.ok) {
      console.error("⚠️ Telegram video error:", resp);
    } else {
      console.log("🎬 Telegram video sent:", filename);
    }
  } catch (e) {
    console.error("⚠️ Telegram video send failed:", e?.message || e);
  }
}

// --- Setup ---
const connection = new Connection(RPC_URL, "confirmed");
const wallet = Keypair.fromSecretKey(Uint8Array.from(secretArray));
const mintPubkey = new PublicKey(TOKEN_MINT_STR);

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

    // Resolve program + decimals
    if (TOKEN_DECIMALS_ENV !== undefined && TOKEN_DECIMALS_ENV !== "") {
      DECIMALS = Number(TOKEN_DECIMALS_ENV);
      if (Number.isNaN(DECIMALS) || DECIMALS < 0 || DECIMALS > 12) {
        console.error("❌ Invalid TOKEN_DECIMALS:", TOKEN_DECIMALS_ENV);
        process.exit(1);
      }
      if (TOKEN_PROGRAM_ENV === "TOKEN_2022") {
        programId = TOKEN_2022_PROGRAM_ID;
        console.log("⚙️ Using manual TOKEN_2022");
      } else {
        programId = TOKEN_PROGRAM_ID;
        console.log("⚙️ Using manual TOKEN");
      }
      console.log("⚙️ Using manual TOKEN_DECIMALS =", DECIMALS);
    } else {
      console.log("ℹ️ Auto-detecting mint decimals...");
      let mintInfo;
      try {
        mintInfo = await getMint(connection, mintPubkey, "confirmed", TOKEN_PROGRAM_ID);
        programId = TOKEN_PROGRAM_ID;
        console.log("✅ Using TOKEN program");
      } catch (e1) {
        console.log("ℹ️ TOKEN program failed, trying TOKEN_2022...");
        try {
          mintInfo = await getMint(connection, mintPubkey, "confirmed", TOKEN_2022_PROGRAM_ID);
          programId = TOKEN_2022_PROGRAM_ID;
          console.log("✅ Using TOKEN_2022 program");
        } catch (e2) {
          console.error("❌ Failed to load mint with either TOKEN or TOKEN_2022");
          console.error("e1:", e1?.message || e1);
          console.error("e2:", e2?.message || e2);
          process.exit(1);
        }
      }
      DECIMALS = mintInfo.decimals;
      console.log("🔢 Mint decimals:", DECIMALS);
    }

    // Mint supply before burn
    let supplyBeforeBase = null;
    try {
      const mintInfoBefore = await getMint(connection, mintPubkey, "confirmed", programId);
      supplyBeforeBase = mintInfoBefore.supply;
      console.log("🏦 Mint total supply BEFORE (base):", supplyBeforeBase.toString());
    } catch (e) {
      console.error("⚠️ Failed to fetch supply before burn:", e?.message || e);
    }

    // Burn amount in base units
    const amountBaseUnits = BigInt(Math.floor(BURN_AMOUNT_UI * 10 ** DECIMALS));
    if (amountBaseUnits <= 0n) {
      console.error("❌ Burn amount in base units is 0; check BURN_AMOUNT and decimals.");
      process.exit(1);
    }

    // Burner ATA
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

    const currentAmount = ata.amount;
    console.log("💰 Current burner balance (base):", currentAmount.toString());

    if (currentAmount < amountBaseUnits) {
      console.error("❌ Not enough balance to burn.");
      console.error("Required:", amountBaseUnits.toString());
      console.error("Have    :", currentAmount.toString());
      process.exit(1);
    }

    // Burn
    
// Send initial message






console.log("🔥 Burning", BURN_AMOUNT_UI, "tokens...");
    const txSig = await burnChecked(
      connection,
      wallet,
      ata.address,
      mintPubkey,
      wallet.publicKey,
      amountBaseUnits,
      DECIMALS,
      [],
      { commitment: "confirmed" },
      programId
    );
    console.log("✅ Burn successful!");
    console.log("🧾 Tx signature:", txSig);

    // Mint supply after burn
    let supplyAfterBase = null;
    if (supplyBeforeBase !== null) {
      supplyAfterBase = supplyBeforeBase - amountBaseUnits;
      console.log("🏦 Mint total supply AFTER (computed base):", supplyAfterBase.toString());
    } else {
      try {
        const mintInfoAfter = await getMint(connection, mintPubkey, "confirmed", programId);
        supplyAfterBase = mintInfoAfter.supply;
        console.log("🏦 Mint total supply AFTER (fetched base):", supplyAfterBase.toString());
      } catch (e) {
        console.error("⚠️ Failed to fetch supply after burn:", e?.message || e);
      }
    }

    // Refresh burner ATA
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
    console.log("🔁 Remaining burner balance after burn (UI):", remainingUi);

    // --- Airdrop tracking for TG message ---
    let airdropSummary = null;
    let airdropDetailsLines = [];
    let airdropFileText = null;

    // --- AIRDROP ---
    if (AIRDROP_TOTAL_UI > 0 && MIN_HOLD_UI > 0) {
      const airdropTotalBase = BigInt(AIRDROP_TOTAL_UI) * (10n ** BigInt(DECIMALS));
      const minHoldBase = BigInt(MIN_HOLD_UI) * (10n ** BigInt(DECIMALS));
      const maxHoldBase = MAX_HOLD_UI > 0 ? BigInt(MAX_HOLD_UI) * (10n ** BigInt(DECIMALS)) : 0n;

      if (remainingBaseUnits < airdropTotalBase) {
        console.log("⚠️ Not enough balance for airdrop of", AIRDROP_TOTAL_UI, "AKIO; skipping airdrop.");
      } else {
        console.log("🔎 Fetching all AKIO holders via getParsedProgramAccounts...");
        const parsedAccounts = await connection.getParsedProgramAccounts(
          programId,
          {
            filters: [
              { dataSize: 165 },
              { memcmp: { offset: 0, bytes: mintPubkey.toBase58() } },
            ],
          }
        );

        console.log("📊 Total token accounts:", parsedAccounts.length);

        // Aggregate balances by owner
        const ownerBalances = new Map();
        for (const acc of parsedAccounts) {
          const parsed = acc.account.data.parsed;
          if (!parsed || parsed.type !== "account") continue;
          const info = parsed.info;
          const owner = info.owner;
          const amountStr = info.tokenAmount.amount;
          const amountBase = BigInt(amountStr);
          if (amountBase <= 0n) continue;
          const prev = ownerBalances.get(owner) || 0n;
          ownerBalances.set(owner, prev + amountBase);
        }

        const totalHolders = ownerBalances.size;
        console.log("👥 Total distinct holders:", totalHolders);

        // Filter to [MIN_HOLD_UI, MAX_HOLD_UI] range
        const eligible = [];
        for (const [owner, balBase] of ownerBalances.entries()) {
          if (balBase < minHoldBase) continue;
          if (maxHoldBase > 0n && balBase > maxHoldBase) continue;
          eligible.push({ owner, balBase });
        }

        console.log(
          "🎯 Holders with between",
          MIN_HOLD_UI,
          "and",
          MAX_HOLD_UI > 0 ? MAX_HOLD_UI : "∞",
          "AKIO:",
          eligible.length
        );

        if (eligible.length === 0) {
          console.log("⚠️ No eligible holders; skipping airdrop.");
        } else {
          let sumEligibleBase = 0n;
          for (const h of eligible) sumEligibleBase += h.balBase;
          console.log("🧮 Sum of eligible balances (base):", sumEligibleBase.toString());

          let allocatedTotal = 0n;
          const perHolderShares = [];
          for (const h of eligible) {
            const shareBase = (airdropTotalBase * h.balBase) / sumEligibleBase;
            if (shareBase <= 0n) continue;
            allocatedTotal += shareBase;
            const shareUi = Number(shareBase) / 10 ** DECIMALS;
            perHolderShares.push({ owner: h.owner, shareBase, shareUi });
          }

          console.log("📤 Planned distribute (base):", allocatedTotal.toString());
          console.log("📤 Planned distribute (UI):", Number(allocatedTotal) / 10 ** DECIMALS);
          console.log("📬 Number of recipients:", perHolderShares.length);

          if (allocatedTotal > airdropTotalBase) {
            console.error("❌ Allocated > airdrop total; aborting airdrop.");
          } else {
            // Build summary + detail lines for TG
            airdropSummary = {
              totalHolders,
              eligibleCount: eligible.length,
              recipients: perHolderShares.length,
              totalUi: Number(allocatedTotal) / 10 ** DECIMALS,
            };
            airdropDetailsLines = perHolderShares.map((h) => {
              const amtStr = formatAmount(h.shareBase, DECIMALS);
              return `• \`${h.owner}\` — ${amtStr} AKIO`;
            });

            // Build full airdrop file text (CSV-like)
            const fileLines = [];
            fileLines.push(`AKIO Airdrop Distribution - ${formatTorontoTime()}`);
            fileLines.push(`Total airdrop: ${AIRDROP_TOTAL_UI.toLocaleString("en-US")} AKIO`);
            fileLines.push(`Min holding: ${MIN_HOLD_UI.toLocaleString("en-US")} AKIO`);
            fileLines.push(`Max holding: ${MAX_HOLD_UI > 0 ? MAX_HOLD_UI.toLocaleString("en-US") + " AKIO" : "No max"}`);
            fileLines.push("");
            fileLines.push("Account                          Token received");
            fileLines.push("--------------------------------------------------------------");
            for (const h of perHolderShares) {

        const amtStr = formatAmount(h.shareBase, DECIMALS);
        fileLines.push(`${h.owner}  ${amtStr}`);
      }
//      airdropFileText = fileLines.join("\n");	

for (const h of perHolderShares) {
  const amtStr = formatAmount(h.shareBase, DECIMALS);
  fileLines.push(`${h.owner}  ${amtStr}`);
}
airdropFileText = fileLines.join("\n");

// 🔥 Send AKIO WARRIOR image to Telegram before airdrop starts
if (TG_BOT_TOKEN && TG_CHAT_ID) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        photo: "https://raw.githubusercontent.com/gtgdeveloper/gx/main/akio1.png",   // ← CHANGE THIS
        caption: "🔥 *AKIO WARRIOR BURN EVENT AND AIR DROP IN PROGRESS* 🔥",
        parse_mode: "Markdown"
      })
    })
    .then(res => res.json())
    .then(data => {
      if (!data.ok) console.error("⚠️ Telegram sendPhoto error:", data);
    });

  } catch (e) {
    console.error("⚠️ Telegram sendPhoto failed:", e.message);
  }
}

console.log("🚀 Starting airdrop from burner ATA:", ata.address.toBase58());

for (const [index, h] of perHolderShares.entries()) {





              const ownerPubkey = new PublicKey(h.owner);
              console.log(
                `➡️ [${index + 1}/${perHolderShares.length}] Airdropping ~${h.shareUi} AKIO to ${ownerPubkey.toBase58()}`
              );
              try {
                const recipientAta = await getOrCreateAssociatedTokenAccount(
                  connection,
                  wallet,
                  mintPubkey,
                  ownerPubkey,
                  false,
                  "confirmed",
                  { commitment: "confirmed" },
                  programId
                );

                const sig = await transferChecked(
                  connection,
                  wallet,
                  ata.address,
                  mintPubkey,
                  recipientAta.address,
                  wallet.publicKey,
                  h.shareBase,
                  DECIMALS,
                  [],
                  { commitment: "confirmed" },
                  programId
                );
                console.log("   ✅ Airdrop tx:", sig);
              } catch (e) {
                const msg = e?.message || String(e);
                if (msg.includes("TokenOwnerOffCurveError")) {
                  console.error("   ⚠️ Skipping off-curve owner", ownerPubkey.toBase58());
                  continue;
                }
                console.error("   ⚠️ Airdrop failed for", ownerPubkey.toBase58(), "-", msg);
              }
            }
      console.log("🎉 Airdrop complete.");

// === 🛑 STOP FLASHING & SET FINAL CAPTION ===



          }
        }
      }
    } else {
      console.log("ℹ️ Airdrop disabled or not configured (AIRDROP_TOTAL_UI / MIN_HOLD_UI).");
    }

    // --- TELEGRAM MESSAGE ---
    const whenStr = formatTorontoTime();
    const solscanUrl = `https://solscan.io/tx/${txSig}`;

    const beforeUiStr = supplyBeforeBase !== null ? formatAmount(supplyBeforeBase, DECIMALS) : "unknown";
    const afterUiStr = supplyAfterBase !== null ? formatAmount(supplyAfterBase, DECIMALS) : "unknown";
    const burnUiStr = BURN_AMOUNT_UI.toLocaleString("en-US");

    const ORIGINAL_SUPPLY_UI = 1_000_000_000;

    let totalBurnedUiText = "unknown";
    if (supplyAfterBase !== null) {
      const originalBase = BigInt(ORIGINAL_SUPPLY_UI) * (10n ** BigInt(DECIMALS));
      let burnedBase = originalBase - supplyAfterBase;
      if (burnedBase < 0n) burnedBase = 0n;
      const burnedUi = Number(burnedBase) / 10 ** DECIMALS;
      totalBurnedUiText = burnedUi.toLocaleString("en-US");
    }

    const goalTarget = "200,000,000";

    const burnHistoryUrl =
      "https://solscan.io/token/Akiox1GAxohWdggSLaFpChxLyS54vz7P7YaF1tckWEQu?activity_type=ACTIVITY_SPL_BURN&exclude_amount_zero=false&remove_spam=false&page_size=10";
    const websiteUrl = "https://www.akio.one";
    const twitterUrl = "https://x.com/Akio_EW";

    // First message: burn + supply tracker
  const burnTgText =
`📉 *AKIO Burn Update*\n\n` +
`${whenStr} ()\n\n` +
`Before burn tokens outstanding: \`${beforeUiStr}\`\n` +
`Burned: *${burnUiStr}* AKIO\n` +
`New supply: \`${afterUiStr}\`\n\n` +
`📊 *Supply Tracker*\n` +
`• Original: 1,000,000,000\n` +
`• Burned: *${totalBurnedUiText}* AKIO\n` +
`• Goal: *${goalTarget}+* by Dec 31, 2025 🔥\n\n` +
`[View this burn](${solscanUrl}) | [All burns](${burnHistoryUrl})\n` +
`[Website](${websiteUrl}) | [X/Twitter](${twitterUrl})\n\n` +
`🚀 Buy AKIO on [Dexscreener](https://dexscreener.com/solana/8dmbh2rrvgpmjzbrdu5kegphq3qagf95eh16ypsmswyo)\n` +
`📈 Or on [Ascendex](https://ascendex.com/en/cashtrade-spottrading/usdt/akio)\n` +
`🟡 Listed on [CoinGecko](https://www.coingecko.com/en/coins/akio)`;


    await sendTelegramMessage(burnTgText);
console.log("📨 Telegram message sent.");

const scheduleUrl = "https://raw.githubusercontent.com/gtgdeveloper/gx/main/akio-burn/akio_burn_schedule.txt";

const scheduleMsg =
  "📄 *AKIO DAILY BURN SCHEDULE*\n" +
  `[Tap here to view the full schedule](${scheduleUrl})`;

await sendTelegramMessage(scheduleMsg);




const burnVideos = [
  "video1b.mp4",
  "video2.mp4",
  "video3.mp4",
  "video4.mp4",
  "video5.mp4",
  "video6.mp4",
  "video7.mp4"
];



    const chosenBurnVideo = burnVideos[Math.floor(Math.random() * burnVideos.length)];
    await sendTelegramVideo(chosenBurnVideo, "This burning event is brought you by Avvenire.com");


    // Second message (after 2 minutes): airdrop summary + file link, if we ran an airdrop
    if (airdropSummary) {
      console.log("⏳ Waiting 2 minutes before sending airdrop Telegram message...");
      await sleep(AIRDROP_SECOND_MSG_DELAY_MS);

      const rangeText =
        MAX_HOLD_UI > 0
          ? `${MIN_HOLD_UI.toLocaleString("en-US")} and ${MAX_HOLD_UI.toLocaleString("en-US")}`
          : `${MIN_HOLD_UI.toLocaleString("en-US")}+`;

      const header =
        `🎁 *Airdrop Event*\n` +
        `Now for the fun part... we are airdropping hourly *${AIRDROP_TOTAL_UI.toLocaleString("en-US")}* AKIO to holders with minimum of  *${rangeText}* tokens.\n` +
        `Eligible holders: *${airdropSummary.eligibleCount}* out of *${airdropSummary.totalHolders}* total.\n` +
        `Recipients: *${airdropSummary.recipients}*.\n` +
        `Airdrop completed.\n`;

     const footer =
  `\n\nFull distribution file is attached below.\n` +
  `\nCheck your wallets. Next airdrop in *1 hour*. Don't miss it! ` +
  `Millions of tokens will be distributed daily until December 31 in 24 payments a day. ` +
  `Only from *AKIO!!* The best tokenomics ever. Reducing the supply daily and increasing the tokens for their long term holders. No staking required. This is a real coin with value.\n\n` +
  `⚠️ This will not work in Ascendex. Use Solflare or Phantom!\n\n` +
  `🔗 *Ascendex*\nhttps://ascendex.com/en/cashtrade-spottrading/usdt/akio\n\n` +
  `🚀 *Dexscreener*\nhttps://dexscreener.com/solana/8dmbh2rrvgpmjzbrdu5kegphq3qagf95eh16ypsmswyo\n\n` +
  `🟡 *CoinGecko*\nhttps://www.coingecko.com/en/coins/akio\n\n` +
  `💼 *Sponsor: Avvenire Technologies*\nhttps://avvenire.com`;

//      const airdropTgText = header + footer;
const caption = header + footer;

if (TG_BOT_TOKEN && TG_CHAT_ID) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        // use the raw GitHub URL (or whatever you prefer) for akio2.jpg:
        photo: "https://raw.githubusercontent.com/gtgdeveloper/gx/main/akio1.png",
        caption,
        parse_mode: "Markdown"
      })
    })
      .then(res => res.json())
      .then(data => {
        if (!data.ok) {
          console.error("❌ Telegram sendPhoto error (airdrop event):", data);
        }
      });
  } catch (e) {
    console.error("❌ Telegram sendPhoto failed (airdrop event):", e?.message || e);
  }
}
	



//      await sendTelegramMessage(airdropTgText);

      if (airdropFileText) {
        const safeDate = new Date().toISOString().split("T")[0];
        const filename = `akio-airdrop-${safeDate}.txt`;
        await sendTelegramDocument(filename, airdropFileText);
      }

      await sendTelegramVideo("video1b.mp4", "This airdrop was brought you by Avvenire.com");
    }
    // --- LOG JSON ---
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
      airdropTotalUi: AIRDROP_TOTAL_UI,
      minHoldUi: MIN_HOLD_UI,
      maxHoldUi: MAX_HOLD_UI,
      airdropSummary,
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
