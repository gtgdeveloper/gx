const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const { getOrCreateAssociatedTokenAccount, transfer } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const https = require("https");

const RPC = "https://bold-powerful-film.solana-mainnet.quiknode.pro/3e3c22206acbd0918412343760560cbb96a4e9e4";
const connection = new Connection(RPC, "confirmed");
const MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

const REPO_PATH = path.join(__dirname); // assuming script is inside the repo
const BONUS_LOG_FILE = path.join(REPO_PATH, "bonus-log.json");
const BONUS_FAILED_FILE = path.join(REPO_PATH, "bonus-failed.json");
const HOLDERS_URL = "https://raw.githubusercontent.com/gtgdeveloper/gx/main/gtg-holders.json";

const secretArray = JSON.parse(process.env.BURNER_KEY);
const wallet = Keypair.fromSecretKey(new Uint8Array(secretArray));

const prizes = [
  { rank: 1, amount: 50.00 },
  { rank: 2, amount: 20.00 },
  { rank: 3, amount: 9.00 },
  { rank: 4, amount: 3.00 },
  { rank: 5, amount: 3.00 },
  { rank: 6, amount: 3.00 },
  { rank: 7, amount: 3.00 },
  { rank: 8, amount: 3.00 },
  { rank: 9, amount: 3.00 },
  { rank: 10, amount: 3.00 }
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

function runCommand(command) {
  try {
    execSync(command, { stdio: "inherit" });
  } catch (err) {
    console.error(`Command failed: ${command}`);
    console.error(err.message);
  }
}

function pushBonusLogToGitHub() {
  console.log("📤 Uploading bonus logs to GitHub...");
  const repoPath = path.resolve(__dirname);
  process.chdir(repoPath);

  try {
    runCommand('git config user.name || git config user.name "AutoCommitBot"');
    runCommand('git config user.email || git config user.email "bot@example.com"');
  } catch (e) {
    console.warn("⚠️ Failed to auto-config Git user");
  }

  try {
    runCommand("git checkout main");
  } catch (e) {
    console.error("❌ Not on a Git branch. Skipping upload.");
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("❌ GITHUB_TOKEN not set. Skipping push.");
    return;
  }
  const remoteUrl = `https://${token}@github.com/gtgdeveloper/gx.git`;

  try {
    execSync("git remote show origin", { stdio: "ignore" });
  } catch (err) {
    console.log("🔧 Adding missing 'origin' remote...");
    runCommand(`git remote add origin ${remoteUrl}`);
  }

  runCommand("git pull origin main");
  runCommand("git add bonus-log.json bonus-failed.json");
  runCommand(`git commit -m "Auto-upload bonus logs [${new Date().toISOString()}]" || echo 'No changes to commit'`);
  runCommand("git push origin main");
  console.log("✅ bonus-log.json pushed to GitHub.");
}

function loadHoldersFromGitHub() {
  return new Promise((resolve, reject) => {
    https.get(HOLDERS_URL, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

(async () => {
  const holders = await loadHoldersFromGitHub();
  console.log(`🔍 Loaded ${holders.length} holders from GitHub`);

  const winners = shuffle(holders).slice(0, 10);
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

    await delay(5000);
  }

  fs.writeFileSync(BONUS_LOG_FILE, JSON.stringify(log, null, 2));
  fs.writeFileSync(BONUS_FAILED_FILE, JSON.stringify(failed, null, 2));
  console.log("✅ Bonus winners saved to bonus-log.json");
  console.log("⚠️ Failed transfers saved to bonus-failed.json");

  pushBonusLogToGitHub();
})();
