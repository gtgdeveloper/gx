
const fs = require("fs");
const fetch = require("node-fetch");
const { Connection, PublicKey } = require("@solana/web3.js");

const RPC_ENDPOINT = "https://bold-powerful-film.solana-mainnet.quiknode.pro/3e3c22206acbd0918412343760560cbb96a4e9e4";
const connection = new Connection(RPC_ENDPOINT, "confirmed");
const GTG_MINT = new PublicKey("4nm1ksSbynirCJoZcisGTzQ7c3XBEdxQUpN9EPpemoon");

const gtg_price_usd = 0.0004394;
const sol_price_usd = 161.77;
const gtg_price_in_sol = gtg_price_usd / sol_price_usd;

const GITHUB_OWNER = "gtgdeveloper";
const GITHUB_REPO = "gx";
const GITHUB_BRANCH = "main";
const GITHUB_FILE_PATH = "gtgsol-5-full.json";

const excludedWallets = new Set([
  "F4DACnJRJYhcYswDwHaoLDi9tccwDbiNsA6eyoudTNup",
  "3pNpU9vd6zX1vtDhtopHdArpPoc1xvExhpP8GNwN3psv",
  "8BNhLtB5f2PK9YXWiZi5VnEqWQxQ35d7bqeeqxRy3eG4",
  "FJsAKTFA8HR2zmQZREkseADHx2JSJoAxUkNE7qA5J4F",
  "8pUAJFGKy9ARtxJq2t31wFmf6nqjaw8pZEbAWhNSpKc8",
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
  console.log("🚀 Fetching GTG holders...");

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
    }
  );

  const holders = [];
  let totalGTG = 0;
  let totalSOL = 0;

  for (const account of tokenAccounts) {
    const data = account.account.data;
    const owner = new PublicKey(data.slice(32, 64)).toBase58();
    const amount = Number(data.readBigUInt64LE(64)) / 10 ** 9;

    if (amount >= 20000 && amount <= 70000000 && !excludedWallets.has(owner)) {
      totalGTG += amount;
      const sol_equiv = amount * gtg_price_in_sol;
      totalSOL += sol_equiv;
      holders.push({ owner, amount });
    }
  }

  for (const holder of holders) {
    holder.percentage = (holder.amount / totalGTG) * 100;
    holder.double_amount_for_100_apy = holder.amount * 2;
    holder.sol_equivalent_for_100_apy = holder.amount * gtg_price_in_sol;
    holder.daily_sol_for_100_apy = holder.sol_equivalent_for_100_apy / 365;
  }

  fs.writeFileSync("gtgsol-5-full.json", JSON.stringify(holders, null, 2));
  console.log("✅ Exported gtgsol-5-full.json");

  console.log(`📊 Total qualifying GTG tokens: ${totalGTG.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
  console.log(`💸 Total SOL required for 100% APY: ${totalSOL.toFixed(4)} SOL`);

  await uploadToGitHub(holders, GITHUB_FILE_PATH);
})();

async function uploadToGitHub(data, filePath) {
  const token = process.env.GITHUB_TOKEN;
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;
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
    message: `Update ${filePath}`,
    content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
    branch: GITHUB_BRANCH
  };
  if (sha) body.sha = sha;

  const uploadRes = await fetch(apiUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  if (uploadRes.ok) {
    console.log(`☁️ Uploaded ${filePath} to GitHub.`);
  } else {
    console.error(`❌ Failed to upload ${filePath}`, await uploadRes.text());
  }
}
