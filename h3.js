
const fs = require("fs");
const fetch = require("node-fetch");
const { Connection, PublicKey } = require("@solana/web3.js");

const RPC_ENDPOINT = "https://bold-powerful-film.solana-mainnet.quiknode.pro/3e3c22206acbd0918412343760560cbb96a4e9e4";
const connection = new Connection(RPC_ENDPOINT, "confirmed");
const GTG_MINT = new PublicKey("4nm1ksSbynirCJoZcisGTzQ7c3XBEdxQUpN9EPpemoon");

const excludedWallets = new Set([
  "F4DACnJRJYhcYswDwHaoLDi9tccwDbiNsA6eyoudTNup",
  "F8gacHyY4APg1ceiUQHVBteHdQ4htTtJxw24wMVTEKWf",
  "9ZHiw3wqtYxrppgAfEbXResxWUasSiVN3jmjQrU9wQYA",
  "2gGSZD8MrrbP1YKJTiQfp5puvVKuMsgAULFAKnF6PSSg",
  "H1G8MR8m7o3xf9Z1wEBGixZ7MAgXGmM1A8L7VcDi16Lb",
  "E5hubdTm1g2PWRLdgjCCVnLhWxc4X1dXNnFgHTM8Wz9c",
  "HyhfwRRSYEL8frDr2kxrmAGgjzJKwyiSbpSALxrwXQfJ",
  "427RBNJvXSDGWSaPFG3YK8U6hR36XiKVZcLYFJnQNCr4",
  "42bCmuhppv9TeQ731mz5xLz5R5NnW8HvPjZPK9H1NJez",
  "BW6ss9hx7EubC7XfwDeCaWoXq8YzEXC3yjGDRMbgEoH8",
  "DzFATJqBCNUnRPUChCxsCtBnUuo7KKVVq3nPLpidnUMP",
  "8pLXCR7fKRaSd7tiriTyCMVb3S1rBSd29mJPU1sFkGuh",
  "ELwyps9sfZ5XmZ4tWgiSGgQbrsKDngsgm9ZxMxHFacM",
  "3mnnj8Ux25bCZ6Mj7VFRDMZoZ9S43fQfjaeNVSqD28Nz",
  "5y8ijbjxfms9GJeyXqTr8iCRqJ5xXWeEHwQpvjK8h5xh",
  "ED8ZpXkydsUZ8YchZDEBjKwdLk4Zqqs8Y8H1XocjhRPN",
  "FAfCCF5A3ZLRS4pBtcPpmpuyNRxmXW6Hj8cfx23XnTbC",
  "7n3UceCNFgSSYCfHVCTeaNAp8dHRv9za6BDvg3XAVcMb",
  "TRSQujxiGfZfM9kQTn4agqr7tfVu1RB1PPvKtCxGvWP",
  "HiyGnXgKuZKFGF6ZoS9Hki4r3mdDmDudGcW5XTQNhJyf",
  "HfGYxdGD123CjYrSyXdWww2az6AMKqmfzFdmDojrynrh",
  "BXEQkRAh5uHP72xqe9efBQRuB2hS3qpuebDp5canP7Pa",
  "5sYuzP7rarmkFCM2m29RmEQSgi4cAgiBBWSvTbg4RhAH",
  "G3fkSwJ7GecBv19g7tT8Rc3YLcyCDiKj9TvdPR5NjfKb",
  "6gKYfBR8Lyt69EhvjKRMuD6hZstVricyoRxyLh3pCTZ6",
  "53YvHR4fsz6trVqjusiyqruhgr1tT8TGSRGPuRAfWMtZ",
  "2tVkWmHTtpht7FRi8n6XkHm8E6G1UyVyUPFQa6946KCk",
  "AzUXusuDcaUfE8VXtFciuPPnzr4RiypwBz5NL6uiydRu",
  "DEk1ZEp7xv8HeP6RHmysx1xJDLeer2qVhawwVjFF364u"
]);

(async () => {
  console.log("🚀 Starting gtgsol.json export...");

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

  const gtgSolHolders = [];

  for (const account of tokenAccounts) {
    const data = account.account.data;
    const owner = new PublicKey(data.slice(32, 64)).toBase58();
    const amount = data.readBigUInt64LE(64);
    const amountInGTG = Number(amount) / 10 ** 9;

    if (
      amountInGTG >= 20000 &&
      !excludedWallets.has(owner)
    ) {
      gtgSolHolders.push({ owner, amount: amountInGTG });
    }
  }

  await uploadToGitHub(gtgSolHolders, "gtgsol.json");
})();

async function uploadToGitHub(data, path = "gtgsol.json") {
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
