
const fs = require("fs");
const fetch = require("node-fetch");
const { Connection, PublicKey } = require("@solana/web3.js");

const RPC_ENDPOINT = "https://stylish-omniscient-ensemble.solana-mainnet.quiknode.pro/51986126f61b01a87be498e475f7e53502ff8661/";
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
  "5YVoJ5885V8xrAeexyPuDyR18DkWCjWW4CbsEAcD2Mxf",
  "63D9Q6TFCwNz5yVesfUWiagMzfLe9UBHWaTLKBJkUveJ",
  "5eUMoCzfspp55NjjsaquKHsAT5sgAEfMcQ6RSWEaUS21",
  "G4FEBzQRvEzXfUvtsJSweSRBwVnJAb4SLse3yerbSS1Q",
  "FfnR5LqeBRGLV1n9LQS8bhapwJnmFxgADgFifBA63zkU",
  "5AEL4CwK7RhnL57fY1YKw8H35nUA77MH3YmYf5wjadqZ",
  "FaCWtR6MawsWwQYGAXLJacww7J4S9RYkBT3hqGH6dAzH",
  "F2ppiQwBqBAX7QdymAGohyj7o6eY5Q9aJMJyj498KakH",
  "AjjxorSYLBZu32u6bmsSC3AHJ8qSC5ccN8yvQwL33Baa",
  "C7nQpxi21LJhaeiAADuWT5xMRnqhiomcoBD9UDPjECWv",
  "53DR76ZJp9d3Q3v7Adr7kvaxKFPSaQs9j1LEi92jUcg",
  "5AAhKREft7qHXYQZM4BZiuNzhUY28syDQs1aD5aJCnAW",
  "7fxUkD4i5yqBvfX5PYz4yjTR5BGaczJjzzNievh3SLJk",
  "CWSBtsbo7N49iH7UuHotAWLrbV1n5FeePXn4rc32FJub",
  "5mQijpL12YSJtGEBxZz2rfoBCoBRCEaFZ5JQPCEWJUYK",
  "9YJJSYjF3aLHqwnJp3VQNR8VG6noFpFxVbuZJmrq2f3g",
  "GNvJjh6P8m3tQqj57JdtnzZ5BWDHccd7C5jQAXH13mVr",
  "E7JnTLcrgdPdLoe53KVFe5yqehZKcioUZrfbytgBvG8y",
  "6SyLbAmhjWCjuvD4mNZanuT8bYZDbPcwM9966px6qR1x",
  "EwqZqL4VkujGwHQE8GBYNoAUdnkvdAyzQZVCQViVvFLZ",
  "AVgJdwDZ3TrC7FXa8qcDCbSDCGLksqapTMyZv5ybgiuy",
  "9fsh7AsaWp5BBMNzSpXDxWrrcM5gs8zYgcAzaXVY1FGU",
  "CW2r6vcz4Nc21LNEnmyijzhTeZ3oBz9F1XoYvxLdYWiC",
  "B6eCTNftSFHo1TfzQ3Xjy7dVrbiGtfELqvAXtFf35quC",
  "DNTv8Lywgo9qHfiKLj9RX5m8mxEfrJYAk7mKVp9naNJD",
  "7TTediuXav7LMupW5y2d78C966peW2vi53qTrMouetyk",
  "65eRCmP8sE7AwLG3xdT7EprXrrsoGjKEfL6yoLB5BECW",
  "G8UyqnFPvZtzu7VG87HGoAfeH5UvJ6rMpso9meJx9k49",
  "5fTUixvys1Hau4tsPZWSc6cfR1SfhzgJMf7i6MWkmEBp",
  "6w9ppKUB9cJYckM8cHpovFoKPb3xg4dvF1JEcq9xKWu8",
  "5YVoJ5885V8xrAeexyPuDyR18DkWCjWW4CbsEAcD2Mxf",
  "7z6zBsnguBEicGokoneb9Qz6oRhkPPDBe7AqHyYdsTU9",
  "3sL8oXCDDYmePCmjpbfDNtsxSvWjjLZL3NtrfDvMTzrr",
  "8QQoSCK9CVpAmSk14dkxvK86bPEHEoeFFH3LW4V45XPK",
  "82HUNR4CVR9RPHwKaGEUYZmSzx3UqwpucKXKo97eYAZa",
  "DRQgsZqnhBkKiLkLV2DNXi83LoGvyStMM1RgZhe9L513",
  "DEJTQmF7cj2BAJypSZUg4jwEcgbRbnSC2xyeyzyiV9Wr",
  "13Ttb4P97Qp2aLPz3gxPLSV3gPZRVuzCWD4aeyaBdG6a",
  "2kYasVvTamdjy9n9naMPevGdfSLoNAcPtJJs1rTGMY19",
  "CNfESsVUViyz6K3UFgzxxXvUNFu4AQNAqyFuA5hdKms3",
  "DDNHTuaneFuMEhySojFCFwch7RoR64cm8WMfj6Eb1fDK",
  "FLNzuDPdnonMwEmRggPan2PRyZ9vXG9uuVoCexhJqddC",
  "AWmyzHn9hG7mM7P3zAUQXM5qriU765Tmf8xjvDoPBzDd",
  "FqofLY44suNi6C2i9862tTti5pgfoS2XLfDDTjGTLokq",
  "FktSywggjtXN9fKbVoLpbAad8YZSywnaNyaw5jDQb7go",
  "Eq5L73qju35S5U6uawqm8i2boagmio4iHqEEuhGWetqL",
  "3pNpU9vd6zX1vtDhtopHdArpPoc1xvExhpP8GNwN3psv",
  "F4DACnJRJYhcYswDwHaoLDi9tccwDbiNsA6eyoudTNup",
  "F8gacHyY4APg1ceiUQHVBteHdQ4htTtJxw24wMVTEKWf",
  "A8XdQUmCjNJoic8GTnM4kMvnktfy5YdY9hNYfe6r3DHg",
  "6w9ppKUB9cJYckM8cHpovFoKPb3xg4dvF1JEcq9xKWu8",
  "5fTUixvys1Hau4tsPZWSc6cfR1SfhzgJMf7i6MWkmEBp",
  "GNDXkmvN4SxiaMjSV6TNoLMNWZ2VbreU9Q7719EvgN3Q",
  "DLe3LRutuBUrksKfQ4BHSVTaSNuxfGdDcxHWMszKuGE3",
  "6Wk8Fm1XGeVV1remSDhSXLbHxboV4V1yAjka7K2PKnnQ",
  "GX7KRJJv3oSTnHLzaC2gV3Hfh4QWGSD4hxCdSaSjFLzu",
  "8z2kggGC8NTfMpqSeJ26BsiNPTT3pYAWJaZFfLthwHs5",
  "9CVKoSRd6SCFZ1Zo1i241SZFkjShmPMH7U1BuPWtSNL8",
  "7Yu9Mkj3Rq5cvks9QRNPrZJzKYpahrJwa8LtMGjWP4JK",
  "3uQMT21QeyLF9897YomqbURLrJBtkJnnaTxJdt9yP69V",
  "ENb5TricyuvHLR9TC5LBdi9JqbbdTKoj5ZqeysWMYtud",
  "FS49wXE4dPi4RXJfGBmA2hAgUjML721topkPJwm8VoCT",
  "8BNhLtB5f2PK9YXWiZi5VnEqWQxQ35d7bqeeqxRy3eG4",
  "FJsAKTFA8HR2zmQZREkseADHx2JSJoAxUkNE7qA5J4F",
  "8z2kggGC8NTfMpqSeJ26BsiNPTT3pYAWJaZFfLthwHs5",
  "2jeZ4cw4f6BkDmrY9CgnvewwtTZqFQYjUqVxPt7KcGAV",
  "6FjdAAHBVAxVxYKEiRRsAq64JB7qEabF3FrEQHXmda6e",
  "DWjrzSBDdiQttytoHHFTvDPu8Sp1pNgv7pkLhuW51SHV",
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
  console.log("✅ Exported  gtgsol-5-full.json");

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
