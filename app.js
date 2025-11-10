import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/database.js";
import route from "./controller/auth/auth.js";
import cors from "cors";
dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(cors());
app.use("/api", route);


const PORT = 5000 ;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

app.get("/", (req, res) => {
  res.send(`<h1>Server is running on port ${PORT}</h1>`);
});
