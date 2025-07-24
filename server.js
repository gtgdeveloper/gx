
const express = require("express");
const app = express();
const path = require("path");

app.use(express.static("public"));

// Explicitly serve data directory if needed
app.use("/data", express.static(path.join(__dirname, "data")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "gtg-dashboard.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
