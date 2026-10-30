// The Glimmer landmark tool's server: the game's dev server, plus a way for the tool page to save into
// public/models/glimmers/meta.json and to list every model (new ones with no meta entry too).
//   node scripts/glimmers/rig-tool.mjs [port]      then open the address it prints
// How to rig a new Glimmer: the top of src/lib/three/glimmerRig.ts.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { formatMeta } from './metaFormat.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = join(repo, 'public/models/glimmers'), metaPath = join(dir, 'meta.json');
const port = +(process.argv[2] ?? 5230);

const save = {
  name: 'glimmer-rig-save',
  configureServer(server) {
    server.middlewares.use('/__rig/list', (_req, res) => {
      const ids = readdirSync(dir).filter(f => f.endsWith('.glb')).map(f => f.slice(0, -4)).sort();
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(ids));
    });
    server.middlewares.use('/__rig/save', (req, res) => {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        try {
          const { id, rig, height } = JSON.parse(body);
          if (!/^[a-z0-9_-]+$/.test(id) || !rig?.plan || !rig?.head) throw new Error('bad request');
          const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
          // a brand-new model: a plain entry (the old wiggle points stay empty; the rig moves it)
          meta[id] ??= { height: height ?? 1, head: rig.head, tail: null, wings: null, ears: null, floats: false };
          meta[id].rig = rig;
          writeFileSync(metaPath, formatMeta(meta));
          console.log(`saved ${id} (${rig.plan})`);
          res.end('ok');
        } catch (e) { res.statusCode = 400; res.end(String(e)); }
      });
    });
  },
};

// its own dependency cache, so it never makes another dev server running in this folder reload
const server = await createServer({ root: repo, configFile: join(repo, 'vite.config.ts'), cacheDir: join(repo, 'node_modules/.vite-rigtool'), plugins: [save], server: { port, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls?.local?.[0] ?? `http://127.0.0.1:${port}/`;
console.log(`\nGlimmer rig tool: ${url}scripts/glimmers/rig.html?id=<glimmer>\nMove sheets:      ${url}scripts/glimmers/moves.html?ids=<glimmer>\n`);
