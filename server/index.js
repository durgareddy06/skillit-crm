import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { Server } from "socket.io";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import studentRoutes from "./routes/students.js";
import adminRoutes from "./routes/admin.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import ticketRoutes from "./routes/tickets.js";
import emailRoutes from "./routes/emails.js";
import { setSocketIo, startInboxMonitoring } from "./services/inboxService.js";

const app = express();
app.set("trust proxy", 1);
app.use(cors());
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  }
});

app.set("io", io);
setSocketIo(io);

io.on("connection", (socket) => {
  console.log(`Socket client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`Socket client disconnected: ${socket.id}`);
  });
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/emails", emailRoutes);
app.get("/uploads/*", (req, res, next) => {
  const relativePath = req.params[0];
  const filePath = path.join(process.cwd(), "uploads", relativePath);

  console.log(`[Static Serve] Request for: ${relativePath}`);
  console.log(`[Static Serve] Full Path: ${filePath}`);
  console.log(`[Static Serve] Range Header: ${req.headers.range || "None"}`);

  // Verify file existence
  if (!fs.existsSync(filePath)) {
    console.error(`[Static Serve] File not found: ${filePath}`);
    return res.status(404).json({ message: "File not found" });
  }

  // Retrieve file stats
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (err) {
    console.error(`[Static Serve] Error reading file stats:`, err);
    return res.status(500).json({ message: "Error reading file details" });
  }

  if (stat.isDirectory()) {
    console.warn(`[Static Serve] Requested path is a directory: ${filePath}`);
    return res.status(403).json({ message: "Access denied" });
  }

  const fileSize = stat.size;
  console.log(`[Static Serve] File Size: ${fileSize} bytes`);

  // Detect MIME type
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".webm": "audio/webm",
    ".aac": "audio/aac",
  };
  const contentType = mimeMap[ext] || "application/octet-stream";
  console.log(`[Static Serve] Content-Type: ${contentType}`);

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    console.log(`[Static Serve] Parsed Range: start=${start}, end=${end}`);

    if (isNaN(start) || start >= fileSize || end >= fileSize || start > end) {
      console.warn(`[Static Serve] Range not satisfiable: ${range} (fileSize: ${fileSize})`);
      res.setHeader("Content-Range", `bytes */${fileSize}`);
      return res.status(416).send("Range Not Satisfiable");
    }

    const chunksize = end - start + 1;
    console.log(`[Static Serve] Serving partial content, chunk size: ${chunksize} bytes`);

    const fileStream = fs.createReadStream(filePath, { start, end });
    
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    });

    fileStream.on("error", (streamErr) => {
      console.error(`[Static Serve] Stream error for ${relativePath}:`, streamErr);
      if (!res.headersSent) {
        res.status(500).send("Stream error");
      }
    });

    fileStream.pipe(res);
  } else {
    console.log(`[Static Serve] Serving entire file (200 OK)`);
    res.writeHead(200, {
      "Accept-Ranges": "bytes",
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    });

    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on("error", (streamErr) => {
      console.error(`[Static Serve] Stream error for ${relativePath}:`, streamErr);
      if (!res.headersSent) {
        res.status(500).send("Stream error");
      }
    });

    fileStream.pipe(res);
  }
});

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Retain alias paths to ensure simulation buttons in frontend testing environments continue to operate natively
app.use("/api/webhooks", emailRoutes);
app.use("/api/email", emailRoutes);

// Fallback error handler so a thrown/rejected promise doesn't crash silently
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server" });
});

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  startInboxMonitoring();
  server.listen(PORT, () => {
    console.log(`SkillIT CRM API running on http://localhost:${PORT}`);
  });
});

// Restart trigger: updated Razorpay keys in .env

