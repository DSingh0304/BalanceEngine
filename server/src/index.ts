import express = require("express");
import console = require("node:console");

// Initialize express application
const app = express();
const PORT = process.env.PORT || 8080;

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Start the express server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}/`);
});
