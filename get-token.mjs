import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import net from 'net';
import tls from 'tls';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);

const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impia3FoZXBya2VoaGp0cmh3Z2dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTYxNzgsImV4cCI6MjA5NzQ3MjE3OH0.aOdw3Nfy93hXddKKXfQsk8UxvjUIkgEldgiSMiwvOBA';
const HOST = 'jbkqheprkehhjtrhwggf.supabase.co';
const proxyUrl = new URL(process.env.HTTPS_PROXY);
const data = JSON.stringify({ email: process.env.APP_EMAIL, password: process.env.APP_PASSWORD });
const OUT = '/tmp/claude-0/-home-user-listako/71662e5e-3841-5429-be01-7090627710f7/scratchpad/session.json';
const ca = readFileSync('/root/.ccr/ca-bundle.crt');

await new Promise((resolve, reject) => {
  const socket = net.connect({ host: proxyUrl.hostname, port: parseInt(proxyUrl.port) }, () => {
    socket.write(`CONNECT ${HOST}:443 HTTP/1.1\r\nHost: ${HOST}:443\r\n\r\n`);
  });
  socket.once('data', (d) => {
    if (!d.toString().includes('200')) { reject(new Error('Proxy CONNECT failed: ' + d.toString().slice(0, 100))); return; }
    const tlsSocket = tls.connect({ socket, servername: HOST, ca }, () => {
      const req = [
        `POST /auth/v1/token?grant_type=password HTTP/1.1`,
        `Host: ${HOST}`,
        `apikey: ${ANON}`,
        `Content-Type: application/json`,
        `Content-Length: ${Buffer.byteLength(data)}`,
        `Connection: close`,
        ``,
        data
      ].join('\r\n');
      tlsSocket.write(req);
      let resp = '';
      tlsSocket.on('data', c => resp += c);
      tlsSocket.on('end', () => {
        const body = resp.split('\r\n\r\n').slice(1).join('');
        writeFileSync(OUT, body);
        resolve();
      });
    });
    tlsSocket.on('error', reject);
  });
  socket.on('error', reject);
});

console.log('Token written to', OUT);
