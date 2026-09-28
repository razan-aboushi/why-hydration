/**
 * A minimal SSR dev server: Vite in middleware mode renders <App/> to HTML on
 * the server, and the client hydrates it. That server HTML is what a hydration
 * mismatch is measured against — a client-only Vite app has none.
 */
import { createServer as createHttpServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createServer as createViteServer } from 'vite';

const port = Number(process.env.PORT ?? 5173);
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'custom',
});

createHttpServer((req, res) => {
  vite.middlewares(req, res, async () => {
    try {
      const url = req.url ?? '/';
      const template = await vite.transformIndexHtml(
        url,
        await readFile(new URL('./index.html', import.meta.url), 'utf8'),
      );
      const { render } = await vite.ssrLoadModule('/src/entry-server.tsx');
      const html = template.replace('<!--app-html-->', render(url));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (error) {
      vite.ssrFixStacktrace(error);
      console.error(error);
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(String(error.stack ?? error));
    }
  });
}).listen(port, () => {
  console.log(`why-hydration Vite example: http://localhost:${port}`);
});
