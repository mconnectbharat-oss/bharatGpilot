
import app from "./server.js";

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`BharatGPilot running on port ${PORT}`);
});

