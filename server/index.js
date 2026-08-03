import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
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
