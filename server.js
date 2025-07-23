const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "gtg-dashboard.html"));
});

app.listen(PORT, () => console.log(`Dashboard live on port ${PORT}`));
