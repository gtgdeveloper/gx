import dotenv from 'dotenv';
import fetch from 'node-fetch';
dotenv.config();

async function uploadToGitHub(data, filename = "data.json") {
  const owner = "gtgdeveloper";
  const repo = "gx";
  const path = filename;
  const token = process.env.GITHUB_TOKEN;

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");

  // Check if file exists to get its sha
  let sha = null;
  const getRes = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (getRes.ok) {
    const getData = await getRes.json();
    sha = getData.sha;
  }

  const uploadRes = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Upload ${filename}`,
      content,
      sha,
      committer: {
        name: "GTG Bot",
        email: "gtg-bot@example.com",
      },
    }),
  });

  const uploadData = await uploadRes.json();

  if (!uploadRes.ok) {
    console.error("❌ GitHub upload failed:", uploadData);
    throw new Error(uploadData.message || "Upload failed");
  }

  console.log(`✅ Uploaded ${filename} to GitHub at path: ${uploadData.content.path}`);
}

async function uploadGTGMetadata(gtgHolders) {
  console.log("📡 uploadGTGMetadata: Placeholder function called.");
}

async function main() {
  // Simulated holdersMap for example
  const holdersMap = new Map([
    ["0x123", 25000],
    ["0x456", 31000],
    ["0x789", 22000]
  ]);

  const gtgHolders = Array.from(holdersMap).map(([owner, amount]) => ({ owner, amount }));
  console.log(`📦 Found ${gtgHolders.length} holders with ≥ 20k GTG`);

  // Upload gtg-holders.json
  await uploadToGitHub(gtgHolders, "gtg-holders.json");

  // Prepare and upload gtgdata.json
  const totalQualifiedSupply = gtgHolders.reduce((sum, h) => sum + h.amount, 0);
  const totalQualifiedHolders = gtgHolders.length;

  const gtgdata = {
    totalQualifiedSupply,
    totalQualifiedHolders,
  };

  await uploadToGitHub(gtgdata, "gtgdata.json");
  console.log("✅ Uploaded gtgdata.json to GitHub:", JSON.stringify(gtgdata, null, 2));

  // Upload metadata
  console.log("📡 Calling uploadGTGMetadata...");
  await uploadGTGMetadata(gtgHolders);
}

main().catch(err => {
  console.error("🚨 Error running main:", err);
});
