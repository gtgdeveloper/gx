
// ✅ Running holders.cjs - Version 2
const fs = require("fs");
const { Connection, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58");

console.log("✅ Running holders.cjs - Version 2");

const RPC_ENDPOINT = "https://bold-powerful-film.solana-mainnet.quiknode.pro/3e3c22206acbd0918412343760560cbb96a4e9e4";
const connection = new Connection(RPC_ENDPOINT, "confirmed");

const GTG_MINT = new PublicKey("4nm1ksSbynirCJoZcisGTzQ7c3XBEdxQUpN9EPpemoon");

async function findGTGHolders() {
  const holdersMap = new Map();

  const largestAccounts = await connection.getTokenLargestAccounts(GTG_MINT);
  const largest = largestAccounts.value;

  for (const acc of largest) {
    const accInfo = await connection.getParsedAccountInfo(new PublicKey(acc.address));
    const data = accInfo.value?.data;
    if (!data || typeof data !== "object" || !data.parsed) continue;

    const owner = data.parsed.info.owner;
    const amount = parseFloat(data.parsed.info.tokenAmount.uiAmountString);

    if (amount >= 20000) {
      holdersMap.set(owner, amount);
    }
  }

  const gtgHolders = Array.from(holdersMap).map(([owner, amount]) => ({ owner, amount }));
  console.log(`📦 Found ${gtgHolders.length} GTG holders`);

  gtgHolders.forEach((holder, index) => {
    console.log(`👤 Holder ${index + 1}: ${holder.owner} - ${holder.amount}`);
  });

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync("./data/gtg-holders.json", JSON.stringify(gtgHolders, null, 2));
  console.log("✅ Holders saved to ./data/gtg-holders.json");
}

findGTGHolders().catch((err) => {
  console.error("❌ Error fetching GTG holders:", err);
});
