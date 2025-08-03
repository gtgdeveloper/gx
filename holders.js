const fs = require("fs");
const fetch = require("node-fetch");
const { Connection, PublicKey } = require("@solana/web3.js");

const RPC_ENDPOINT = "https://bold-powerful-film.solana-mainnet.quiknode.pro/3e3c22206acbd0918412343760560cbb96a4e9e4";
const connection = new Connection(RPC_ENDPOINT, "confirmed");
const GTG_MINT = new PublicKey("4nm1ksSbynirCJoZcisGTzQ7c3XBEdxQUpN9EPpemoon");
const holdersPath = "gtg-holders.json";

(async () => {
  console.log("🚀 Super Starting GTG holder discovery...");

  const holdersMap = new Map();

  console.log("🔄 Fetching EVERY token accounts for GTG...");
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
//
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



  
  await uploadToGitHub(gtgHolders, holdersPath);

  const totalQualifyingSupply = gtgHolders.reduce((sum, h) => sum + h.amount, 0);
  console.log(`📈 Total qualifying supply (≥ 20k GTG): ${totalQualifiedSupply}`);
  const totalHolders = tokenAccounts.length;

  const gtgData = {
    totalQualifyingSupply,
    totalHolders
  };

  await uploadToGitHub(gtgData, "gtgdata.json");

  console.log("✅ Holder data uploaded to GitHub.");
})();

async function uploadToGitHub(data, path = "gtg-holders.json") {
  const owner = "gtgdeveloper";
  const repo = "gx";
  const branch = "main";
  const token = process.env.GITHUB_TOKEN;

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    "Authorization": `token ${token}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "gtg-uploader"
  };

  let sha;
  try {
    const res = await fetch(apiUrl, { headers });
    if (res.ok) {
      const json = await res.json();
      sha = json.sha;
    }
  } catch (e) {
    console.error("SHA fetch failed:", e);
  }

  const body = {
    message: `Update ${path}`,
    content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;

  const uploadRes = await fetch(apiUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  if (uploadRes.ok) {
    console.log(`☁️ Uploaded ${path} to GitHub.`);
  } else {
    console.error(`❌ Failed to upload ${path}`, await uploadRes.text());
  }
}
