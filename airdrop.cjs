
// For GitHub upload of report
const payouts = [];

async function uploadToGitHub(filename, content) {
  const owner = "gtgdeveloper";
  const repo = "gx";
  const branch = "main";
  const token = process.env.GITHUB_TOKEN;

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`;
  const headers = {
    "Authorization": `token ${token}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "gtg-airdrop-uploader"
  };

  // Try to get SHA if file already exists
  let sha;
  try {
    const res = await fetch(apiUrl, { headers });
    if (res.ok) {
      const json = await res.json();
      sha = json.sha;
    }
  } catch (e) {}

  const body = {
    message: "Add airdrop payout report",
    content: Buffer.from(content).toString("base64"),
    branch,
    ...(sha ? { sha } : {})
  };

  const res = await fetch(apiUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("❌ Failed to upload payout report:", err);
  }
}

const fs = require("fs");
const fetch = require("node-fetch");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const { getOrCreateAssociatedTokenAccount, transfer } = require("@solana/spl-token");

// Constants
const AIRDROP_TOTAL = 166_667;
const GTG_MINT = new PublicKey("4nm1ksSbynirCJoZcisGTzQ7c3XBEdxQUpN9EPpemoon");
const RPC_URL = "https://bold-powerful-film.solana-mainnet.quiknode.pro/3e3c22206acbd0918412343760560cbb96a4e9e4";

// Setup connection
const connection = new Connection(RPC_URL, "confirmed");

// Load secret key from environment
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

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

(async () => {
  console.log("🚀 Starting GTG airdrop...");

  // Fetch holders.json from GitHub
  const holders = await fetch("https://raw.githubusercontent.com/gtgdeveloper/gx/main/gtg-holders.json")
    .then(res => res.json())
    .catch(err => {
      console.error("❌ Failed to fetch holders from GitHub:", err);
      process.exit(1);
    });

  // Filter out holders with > 80M tokens
  const eligibleHolders = holders.filter(h => h.amount <= 80_000_000);
  const totalSupply = eligibleHolders.reduce((sum, h) => sum + h.amount, 0);

  console.log(`📊 Eligible holders: ${eligibleHolders.length}`);
  console.log(`📈 Total eligible supply: ${totalSupply}`);

  const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet,
    GTG_MINT,
    wallet.publicKey
  );

  for (const holder of eligibleHolders) {
  if (!holder.owner || typeof holder.owner !== "string") {
    console.warn(`⚠️ Skipping invalid entry:`, holder);
    continue;
  }

  const toWallet = new PublicKey(holder.owner);

    const share = holder.amount / totalSupply;
    const tokensToSend = Math.floor(share * AIRDROP_TOTAL);

    if (tokensToSend <= 0) {
      console.log(`⚠️ Skipping ${holder.owner} — too small to receive.`);
      continue;
    }

    try {
      const toTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet,
        GTG_MINT,
        toWallet
      );

      const sig = await transfer(
        connection,
        wallet,
        fromTokenAccount.address,
       toTokenAccount.address,
       wallet,
        tokensToSend * 1e6 // convert to lamports
     );
//const sig = "SIMULATED_TX_" + Math.random().toString(36).slice(2, 10);

      console.log(`✅ Sent ${tokensToSend} GTG to ${holder.owner} [tx: ${sig}]`);
      payouts.push({ wallet: holder.owner, amount: tokensToSend, tx: sig });
    } catch (e) {
      console.error(`❌ Failed to send to ${holder.owner}:`, e.message);
    }
  }

  
  // Save payout report and upload to GitHub
  const payoutReport = JSON.stringify(payouts, null, 2);
  const reportFilename = "distribution.json";

  await uploadToGitHub(reportFilename, payoutReport);

  console.log(`📤 Payout report uploaded as ${reportFilename}`);
  console.log("✅ Airdrop process complete.");

})();
