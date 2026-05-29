import express, { Request, Response } from "express";
import path from "node:path";
import authRouter from "./auth";
import judgeRouter from "./judge";
import analyticsRouter from "./analytics";
import communityModerationRouter from "./communityModeration";

const app = express();
const port = Number(process.env.PORT) || 8080;
const adminWebDirectory = path.resolve(__dirname, "../../code-learning-app/admin-web");

// Allow the uni-app web client to call the API from a different local origin.
app.use((req: Request, res: Response, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());
app.use("/admin", express.static(adminWebDirectory));

// Basic service probe for manual checks.
app.get("/", (req: Request, res: Response) => {
  res.json({
    service: "cl-app-backend",
    status: "ok",
    message: "Node.js + Express container is running."
  });
});

// Health endpoint used to verify the API process is reachable.
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    uptime: process.uptime()
  });
});

app.get("/admin", (_req: Request, res: Response) => {
  res.sendFile(path.join(adminWebDirectory, "index.html"));
});

app.use("/api/auth", authRouter);
app.use("/api/judge", judgeRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/community", communityModerationRouter);

// Final fallback for unknown routes.
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Not found"
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});
