import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve frontend static files in production
const frontendDist = path.resolve(__dirname, "..", "..", "image-grabber", "dist", "public");
const indexPath = path.join(frontendDist, "index.html");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res) => {
    // Skip API and requests with file extensions
    if (req.path.startsWith("/api/") || path.extname(req.path)) return;
    res.sendFile(indexPath);
  });
  logger.info({ frontendDist }, "Serving frontend static files");
}

export default app;
