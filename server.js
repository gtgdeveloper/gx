const express = require("express");
const path = require("path");
const app = express();


app.use(express.static(__dirname));


// Serve dashboard at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'gtg-dashboard.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Dashboard live on port ${PORT}`));
