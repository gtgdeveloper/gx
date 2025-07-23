// ✅ Running holders.cjs - Version 4 (Filtered)
const fs = require("fs");
const { Connection, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58");

console.log("✅ Running holders.cjs - Version 4 (Filtered)");

const RPC_ENDPOINT = "https://bold-powerful-film.solana-mainnet.quiknode.pro/3e3c22206acbd0918412343760560cbb96a4e9e4";
const connection = new Connection(RPC_ENDPOINT, "confirmed");

const GTG_MINT = new PublicKey("4nm1ksSbynirCJoZcisGTzQ7c3XBEdxQUpN9EPpemoon");

async function findGTGHolders() {
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

  console.log(`🔍 Fetched ${tokenAccounts.length} token accounts for GTG`);

  for (const { account } of tokenAccounts) {
    const data = account.data;

    const ownerBytes = data.slice(32, 64);
    const owner = bs58.encode(ownerBytes);

    const amountBuffer = data.slice(64, 72);
    const amount = Number(amountBuffer.readBigUInt64LE()) / Math.pow(10, 9); // assuming 9 decimals

    if (amount >= 20000) {
      console.log(`👤 ${owner} has ${amount} GTG`);
      holdersMap.set(owner, amount);
    }
  }

  const gtgHolders = Array.from(holdersMap).map(([owner, amount]) => ({ owner, amount }));
  console.log(`📦 Found ${gtgHolders.length} holders with ≥ 20k GTG`);

  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync("./data/gtg-holders.json", JSON.stringify(gtgHolders, null, 2));
  console.log("✅ Holders saved to ./data/gtg-holders.json");
}

findGTGHolders().catch((err) => {
  console.error("❌ Error fetching GTG holders:", err);
});
