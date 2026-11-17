import { createServer as createViteServer } from "vite";
import { createAppFromEnvironment } from "./config.js";

const PORT = Number(process.env.PORT ?? 5173);

// On the laptop, one server answers /api and serves the pages with live reload.
const app = createAppFromEnvironment();
const vite = await createViteServer({ server: { middlewareMode: true } });
app.use(vite.middlewares);

app.listen(PORT, () => {
  console.log(`Friends Food Map is running at http://localhost:${PORT}`);
});
