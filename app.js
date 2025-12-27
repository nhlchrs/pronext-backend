import dotenv from "dotenv";
dotenv.config();

import express from "express";
import connectDB from "./config/database.js";
import route from "./controller/auth/auth.js";
import sessionRoute from "./controller/session/session.js";
import userRoute from "./controller/user/user.js";
import meetingRoute from "./controller/meeting/meeting.js";
import analyticsRoute from "./controller/analytics/analytics.js";
import announcement from "./controller/announcement/announcement.js";
import file from "./controller/files/files.js";
import paymentRoute from "./controller/payment/payment.js";
import kycRoute from "./controller/kyc/kyc.js";
import adminTeamRoute from "./controller/team/adminTeam.js";
import teamRoute from "./controller/team/team.js";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import { requestLogger, errorLogger, performanceMonitor } from "./middleware/loggingMiddleware.js";
import setupRealtimeEvents from "./services/realtimeEventsHandler.js";
connectDB();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
  },
});

// Initialize real-time events
setupRealtimeEvents(io);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// CORS
app.use(cors());

// Logging middleware
app.use(morgan("combined", { stream: { write: (msg) => console.log(msg) } }));
app.use(requestLogger);
app.use(performanceMonitor);

// Apply rate limiting
app.use("/api/", limiter);

// Routes
app.use("/api", route);
app.use("/api", sessionRoute);
app.use("/api", userRoute);
app.use("/api", meetingRoute);
app.use("/api/admin/analytics", analyticsRoute);
app.use("/api", announcement);
app.use("/api/upload", file);
app.use("/api/payments", paymentRoute);
app.use("/api", kycRoute);
app.use("/api", adminTeamRoute);
app.use("/api", teamRoute);

// Socket.io setup
io.on("connection", (socket) => {
  console.log(`✅ New client connected: ${socket.id}`);

  // User events
  socket.on("user_online", (userId) => {
    socket.join(`user:${userId}`);
    socket.join(`notifications:${userId}`);
    io.emit("user_status_changed", { userId, status: "online", timestamp: new Date() });
  });

  socket.on("user_offline", (userId) => {
    socket.leave(`user:${userId}`);
    io.emit("user_status_changed", { userId, status: "offline", timestamp: new Date() });
  });

  // Notification events
  socket.on("subscribe_notifications", (userId) => {
    socket.join(`notifications:${userId}`);
    socket.emit("notification_subscribed", { userId });
  });

  socket.on("unsubscribe_notifications", (userId) => {
    socket.leave(`notifications:${userId}`);
    socket.emit("notification_unsubscribed", { userId });
  });

  // Team subscription
  socket.on("subscribe_team", (teamId) => {
    socket.join(`team:${teamId}`);
  });

  socket.on("unsubscribe_team", (teamId) => {
    socket.leave(`team:${teamId}`);
  });

  // Real-time update subscriptions
  socket.on("subscribe_analytics", () => {
    socket.join("analytics_updates");
    socket.emit("analytics_subscribed");
  });

  socket.on("subscribe_payout_updates", (userId) => {
    socket.join(`payout_updates:${userId}`);
    socket.emit("payout_subscribed", { userId });
  });

  socket.on("unsubscribe_payout_updates", (userId) => {
    socket.leave(`payout_updates:${userId}`);
  });

  // Meeting subscription
  socket.on("subscribe_meeting", (meetingId) => {
    socket.join(`meeting:${meetingId}`);
    socket.emit("meeting_subscribed", { meetingId });
  });

  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server is listening on port ${PORT}`);
  console.log(`🔌 Socket.io is ready for real-time connections`);
});

app.get("/", (req, res) => {
  res.send(`<h1>🚀 ProNext Backend API is running on port ${PORT}</h1>`);
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: 1,
    message: "Server is healthy",
    timestamp: new Date(),
  });
});

// Error handling middleware
app.use(errorLogger);
