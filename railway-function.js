
import app from "./server.js";

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`BharatGPilot running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  server.close(() => {
    console.log("BharatGPilot server stopped.");
    process.exit(0);
  });
});

