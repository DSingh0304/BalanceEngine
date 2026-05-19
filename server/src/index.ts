import express = require("express");
import console = require("node:console");

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}/`);
});
