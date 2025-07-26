import fs from 'fs';
import fetch from 'node-fetch'; // Only needed if you're not on Node.js 18+
import dotenv from 'dotenv';
dotenv.config();

async function uploadToGitHub(data, filename = "data.json") {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");

  const response = await fetch(`https://api.github.com/repos/your-username/your-repo/contents/${filename}`, {
    method: "PUT",
    headers: {
      "Authorization": `token ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: `Update ${filename}`,
      content,
      committer: {
        name: "GTG Bot",
        email: "gtg-bot@example.com"
      }
    })
  });

  if (!response.ok) {
    throw new Error(`❌ GitHub upload failed for ${filename}: ${response.statusText}`);
  }
}

async function uploadGTGMetadata(gtgHolders) {
  // Placeholder function - replace with actual logic as needed
  console.log("📡 uploadGTGMetadata: Placeholder function called.");
}

async function main() {
  // Simulate holdersMap with mock data for this example
  const holdersMap = new Map([
    ["0x123", 25000],
    ["0x456", 31000],
    ["0x789", 22000]
  ]);

  const gtgHolders = Array.from(holdersMap).map(([owner, amount]) => ({ owner, amount }));
  console.log(`📦 Found ${gtgHolders.length} holders with ≥ 20k GTG`);

  // Create summary info
  const totalQualifiedSupply = gtgHolders.reduce((acc, { amount }) => acc + amount, 0);
  const totalQualifiedHolders = gtgHolders.length;

  const gtgdata = {
    totalQualifiedSupply,
    totalQualifiedHolders,
  };

  // Upload GTG holders
  await uploadToGitHub(gtgHolders, "gtgHolders.json");

  // Upload GTG summary data
  await uploadToGitHub(gtgdata, "gtgdata.json");

  console.log("✅ Uploaded gtgdata.json to GitHub:", gtgdata);

  // Call GTG metadata uploader
  console.log("📡 Calling uploadGTGMetadata...");
  await uploadGTGMetadata(gtgHolders);
}

main().catch(err => {
  console.error("🚨 Error running main:", err);
});
