
const fs = require("fs");
const fetch = require("node-fetch");
const { Connection, PublicKey } = require("@solana/web3.js");

const RPC_ENDPOINT = "https://bold-powerful-film.solana-mainnet.quiknode.pro/3e3c22206acbd0918412343760560cbb96a4e9e4";
const connection = new Connection(RPC_ENDPOINT, "confirmed");
const GTG_MINT = new PublicKey("4nm1ksSbynirCJoZcisGTzQ7c3XBEdxQUpN9EPpemoon");

// Upload GTG holders to GitHub
async function uploadToGitHub(gtgHolders) {
  const owner = "gtgdeveloper";
  const repo = "gx";
  const path = "gtg-holders.json";
  const branch = "main";
  const token = process.env.GITHUB_TOKEN;

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    "Authorization": `token ${token}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "gtg-uploader"
  };

  // Step 1: Get existing file SHA if it exists
  let sha;
  try {
    const res = await fetch(apiUrl, { headers });
    if (res.ok) {
      const json = await res.json();
      sha = json.sha;
    }
  } catch (err) {
    console.warn("⚠️ Could not fetch SHA (file might not exist):", err);
  }

  // Step 2: Upload or update file
  const body = {
    message: "Update GTG holders",
    content: Buffer.from(JSON.stringify(gtgHolders, null, 2)).toString("base64"),
    branch,
    ...(sha ? { sha } : {})
  };

  const uploadRes = await fetch(apiUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  if (uploadRes.ok) {
    const result = await uploadRes.json();
    console.log(`✅ XXUploaded to GitHub: ${result.content.html_url}`);
  } else {
    const error = await uploadRes.text();
    console.error("❌ GitHub upload failed:", error);
  }
}

(async () => {
  console.log("🚀 Starting GTG holder discovery...");

  const holdersMap = new Map();

  console.log("🔄 Fetching all token accounts for GTG...");

  const tokenAccounts = await connection.getProgramAccounts(
    new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    {
      filters: [
        { dataSize: 165 },
        {
          memcmp: {
            offset: 0,
            bytes: GTG_MINT.toBase58(),
          },
        },
      ],
      commitment: "confirmed",
    }
  );

  console.log(`🔍 Fetched ${tokenAccounts.length} token accounts.`);

  for (const account of tokenAccounts) {
    const data = account.account.data;
    const owner = new PublicKey(data.slice(32, 64)).toBase58();
    const amount = data.readBigUInt64LE(64);

    if (amount >= 20000n * 10n ** 9n) {
      holdersMap.set(owner, Number(amount) / 10 ** 9);
    }
  }

  const gtgHolders = Array.from(holdersMap).map(([owner, amount]) => ({ owner, amount }));
  console.log(`📦 Found ${gtgHolders.length} holders with ≥ 20k GTG`);

  await uploadToGitHub(gtgHolders);
  await uploadGTGMetadata(gtgHolders);

  console.log("✅ Holders uploaded to GitHub.");
})();



async function uploadGTGMetadata(gtgHolders) {
  const owner = "gtgdeveloper";
  const repo = "gx";
  const path = "gtgdata.json";
  const branch = "main";
  const token = process.env.GITHUB_TOKEN;

  const qualifiedSupply = gtgHolders.filter(h => parseFloat(h.amount) >= 20000).reduce((sum, h) => sum + parseFloat(h.amount), 0);
  const totalHolders = gtgHolders.length;
  const metadataContent = JSON.stringify({ qualifiedSupply, totalHolders }, null, 2);

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    "Authorization": `token ${token}`,
    "Content-Type": "application/json",
  };

  try {
    const getRes = await fetch(apiUrl, { method: "GET", headers });
    const sha = (await getRes.json()).sha;

    const payload = {
      message: "Update GTG metadata",
      content: Buffer.from(metadataContent).toString("base64"),
      branch,
      sha,
    };

    const res = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`GitHub metadata upload failed: ${res.statusText}`);
    }

    console.log("GTG metadata uploaded to gtgdata.json");
  } catch (err) {
    console.error("Error uploading metadata:", err);
  }
}
