
import { Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const GTG_MINT = new PublicKey("YOUR_GTG_MINT_ADDRESS_HERE");

(async () => {
  console.log("🚀 Starting GTG holder discovery...");

  console.log("🔄 Fetching all token accounts for GTG...");
  const tokenAccounts = await connection.getParsedTokenAccountsByMint(GTG_MINT);
  console.log(`🔍 Fetched ${tokenAccounts.value.length} token accounts.`);

  const holdersMap = new Map();

  for (const account of tokenAccounts.value) {
    const data = account.account.data.parsed.info;
    const owner = data.owner;
    const amount = BigInt(data.tokenAmount.amount);

    // Only include holders with ≥ 20,000 GTG
    if (amount >= 20000n * 10n ** 9n) {
      holdersMap.set(owner, Number(amount) / 10 ** 9);
    }
  }

  const gtgHolders = {
    totalFetched: tokenAccounts.value.length,
    filteredCount: holdersMap.size,
    holders: Array.from(holdersMap).map(([owner, amount]) => ({
      owner,
      amount,
    })),
  };

  fs.writeFileSync("gtgdata.json", JSON.stringify(gtgHolders, null, 2));
  console.log(`📦 Found ${holdersMap.size} holders with ≥ 20k GTG`);
  console.log("✅ Holders written to gtgdata.json");
})();
