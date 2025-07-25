
const fs = require("fs");
const { Connection, PublicKey } = require("@solana/web3.js");

const RPC_URL = "https://bold-powerful-film.solana-mainnet.quiknode.pro/3e3c22206acbd0918412343760560cbb96a4e9e4";
const MINT = new PublicKey("4nm1ksSbynirCJoZcisGTzQ7c3XBEdxQUpN9EPpemoon");

const connection = new Connection(RPC_URL, "confirmed");

(async () => {
  console.log("🔍 Fetching token accounts...");
  const accounts = await connection.getProgramAccounts(
    new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), // SPL Token Program
    {
      filters: [
        { dataSize: 165 },
        { memcmp: { offset: 0, bytes: MINT.toBase58() } },
      ],
    }
  );

  console.log(`📦 Found ${accounts.length} token accounts`);

  const holdersMap = new Map();

  for (const { pubkey, account } of accounts) {
    const data = account.data;
    const owner = new PublicKey(data.slice(32, 64)).toBase58();
    const amount = data.readBigUInt64LE(64); // lamports

    // Convert to GTG (divide by 1e6) and filter only if >= 20,000 GTG
    if (amount >= 20000n * 10n ** 6n) {
      const readableAmount = Number(amount) / 1e6;
      holdersMap.set(owner, readableAmount);
    }
  }

  const gtgHolders = Array.from(holdersMap).map(([owner, amount]) => ({ owner, amount }));
  console.log(`✅ Found ${gtgHolders.length} holders with ≥ 20,000 GTG`);

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync("./data/gtg-holders.json", JSON.stringify(gtgHolders, null, 2));
  console.log("💾 Holders saved to ./data/gtg-holders.json");
})();


// GitHub upload
async function uploadToGitHub(filename, content) {
  const fetch = (await import("node-fetch")).default;
  const token = process.env.GITHUB_TOKEN;
  const owner = "gtgdeveloper";
  const repo = "gx";
  const branch = "main";
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`;
  const headers = {
    "Authorization": `token ${token}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "gtg-holder-uploader"
  };

  // Check if file already exists to fetch SHA
  let sha;
  try {
    const res = await fetch(apiUrl, { headers });
    if (res.ok) {
      const json = await res.json();
      sha = json.sha;
    }
  } catch (e) {}

  const body = {
    message: "Update GTG holders list",
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
    console.error("❌ GitHub upload failed:", err);
  } else {
    console.log("📤 GTG holders uploaded to GitHub");
  }
}

// Upload to GitHub after saving locally
uploadToGitHub("gtg-holders.json", JSON.stringify(gtgHolders, null, 2));
