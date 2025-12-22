import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/database.js";
import route from "./controller/auth/auth.js";
import sessionRoute from "./controller/session/session.js";
import userRoute from "./controller/user/user.js";
import meetingRoute from "./controller/meeting/meeting.js";
import analyticsRoute from "./controller/analytics/analytics.js";
import announcement from "./controller/announcement/announcement.js";
import file from "./controller/files/files.js";
import cors from "cors";
dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(cors());

app.use("/api", route);
app.use("/api", sessionRoute);
app.use("/api", userRoute);
app.use("/api", meetingRoute);
app.use("/api/admin/analytics", analyticsRoute);
app.use("/api/announcement", announcement);
app.use("/api/upload", file);


const PORT = 5000 ;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

app.get("/", (req, res) => {
  res.send(`<h1>Server is running on port ${PORT}</h1>`);
});
