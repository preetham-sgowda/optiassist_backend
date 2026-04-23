/**
 * OptiAsset Backend — Express Server Entry Point
 *
 * Configures CORS, JSON parsing, includes all routers,
 * and provides a health check endpoint.
 */

const express = require("express");
const cors = require("cors");
const config = require("./config");

// Import routes
const authRoutes = require("./routes/auth");
const assetRoutes = require("./routes/assets");
const employeeRoutes = require("./routes/employees");
const dashboardRoutes = require("./routes/dashboard");

// ── Create the Express app ────────────────────────────────────────
const app = express();

// ── Middleware ─────────────────────────────────────────────────────
app.use(
  cors({
    origin: [config.frontendUrl, "http://localhost:3000", "http://localhost:3001"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/assets", assetRoutes);
app.use("/employees", employeeRoutes);
app.use("/dashboard", dashboardRoutes);

// ── Health Check ──────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "optiasset-api" });
});

app.get("/", (req, res) => {
  res.json({
    message: "OptiAsset API is running.",
    endpoints: {
      health: "/health",
      auth: "/auth/me",
      assets: "/assets",
      employees: "/employees",
      dashboard: "/dashboard/stats",
    },
  });
});

// ── Start Server ──────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`🚀 OptiAsset API running on port ${config.port}`);
  console.log(`📋 Health check: http://localhost:${config.port}/health`);
});

module.exports = app;
