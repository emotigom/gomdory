import http from 'node:http';

const host = '127.0.0.1';
const requestedPort = Number(process.env.Q2_FOUNDATION_PORT || 0);

const page = `<!doctype html>
<html><body>
  <main data-testid="foundation-ready">Q2 browser foundation ready</main>
  <script>
    console.error('q2-foundation-console-error');
    setTimeout(() => { throw new Error('q2-foundation-page-error'); }, 0);
    fetch('/abort').catch(() => {});
  </script>
</body></html>`;

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${host}`);
  if (url.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"status":"ok"}');
    return;
  }
  if (url.pathname === '/foundation') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(page);
    return;
  }
  if (url.pathname === '/abort') {
    request.socket.destroy();
    return;
  }
  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('not found');
});

let closing = false;
const close = () => {
  if (closing) return;
  closing = true;
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2_000).unref();
};

process.on('SIGTERM', close);
process.on('SIGINT', close);
server.listen(requestedPort, host, () => {
  const address = server.address();
  process.stdout.write(`${JSON.stringify({ host, port: address.port, baseURL: `http://${host}:${address.port}`, pid: process.pid })}\n`);
});
