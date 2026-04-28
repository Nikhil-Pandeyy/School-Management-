import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
 
   // API Route for Unique ID generation
  app.get("/api/generate-id", async (req, res) => {
    // In a production environment, we would check uniqueness against Firestore
    // For now, providing a robust random 5-digit ID generator
    // User requested year suffix at start (e.g., 26 for 2026)
    const yearPrefix = new Date().getFullYear().toString().slice(-2);
    const generate = () => yearPrefix + Math.floor(1000 + Math.random() * 9000).toString();
    res.json({ id: generate() });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
