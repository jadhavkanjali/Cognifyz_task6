require("dotenv").config();

const express = require("express");
const NodeCache = require("node-cache");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const CACHE_TTL = Number(process.env.CACHE_TTL) || 60;

const cache = new NodeCache({
  stdTTL: CACHE_TTL,
  checkperiod: 120
});

const products = [
  { id: 1, name: "Laptop", price: 55000 },
  { id: 2, name: "Keyboard", price: 1200 },
  { id: 3, name: "Mouse", price: 700 },
  { id: 4, name: "Monitor", price: 12000 }
];

const jobs = new Map();

const logDirectory = path.join(__dirname, "logs");
const logFile = path.join(logDirectory, "requests.log");

fs.mkdirSync(logDirectory, { recursive: true });

app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const entry = {
      time: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start
    };

    const line = JSON.stringify(entry);

    console.log(line);

    fs.appendFile(logFile, line + "\n", (error) => {
      if (error) {
        console.error("Could not write request log:", error.message);
      }
    });
  });

  next();
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

app.use("/api", apiLimiter);

app.get("/", (req, res) => {
  res.json({
    project: "Cognifyz Advanced Server-Side Functionality",
    author: "Anjali Jadhav",
    organization: "Cognifyz Technology",
    status: "running",
    features: [
      "Middleware and request logging",
      "Background job processing",
      "Server-side caching",
      "API rate limiting"
    ],
    endpoints: {
      health: "GET /api/health",
      products: "GET /api/products",
      cacheStats: "GET /api/cache/stats",
      clearCache: "DELETE /api/cache",
      createJob: "POST /api/jobs",
      checkJob: "GET /api/jobs/:id"
    }
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is healthy",
    uptimeSeconds: Math.floor(process.uptime())
  });
});

app.get("/api/products", (req, res) => {
  const cachedProducts = cache.get("products");

  if (cachedProducts) {
    res.set("X-Cache", "HIT");

    return res.json({
      success: true,
      source: "cache",
      products: cachedProducts
    });
  }

  cache.set("products", products);

  res.set("X-Cache", "MISS");

  return res.json({
    success: true,
    source: "database-simulation",
    products
  });
});

app.get("/api/cache/stats", (req, res) => {
  res.json({
    success: true,
    keys: cache.keys(),
    stats: cache.getStats(),
    ttlSeconds: CACHE_TTL
  });
});

app.delete("/api/cache", (req, res) => {
  cache.flushAll();

  res.json({
    success: true,
    message: "Cache cleared successfully"
  });
});

app.post("/api/jobs", (req, res) => {
  const { message } = req.body || {};

  if (
    typeof message !== "string" ||
    message.trim().length === 0 ||
    message.length > 200
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide a message of 1 to 200 characters"
    });
  }

  const id = randomUUID();

  const job = {
    id,
    message: message.trim(),
    status: "queued",
    createdAt: new Date().toISOString()
  };

  jobs.set(id, job);

  setImmediate(async () => {
    const currentJob = jobs.get(id);

    if (!currentJob) return;

    currentJob.status = "processing";

    try {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      currentJob.status = "completed";
      currentJob.result = {
        message: "Background task completed successfully",
        processedMessage: currentJob.message
      };
      currentJob.completedAt = new Date().toISOString();
    } catch (error) {
      currentJob.status = "failed";
      currentJob.error = "Job processing failed";
    }
  });

  return res.status(202).json({
    success: true,
    message: "Background job accepted",
    job
  });
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: "Job not found"
    });
  }

  return res.json({
    success: true,
    job
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

app.use((err, req, res, next) => {
  console.error("Request error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request body"
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request body is too large"
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

app.listen(PORT, () => {
  console.log("--------------------------------------");
  console.log("Cognifyz Advanced Server is running");
  console.log("Created by: Anjali Jadhav");
  console.log(`Server URL: http://localhost:${PORT}`);
  console.log("--------------------------------------");
});
