#!/usr/bin/env node

const net = require('net');

const HOST = '127.0.0.1';
const PORT = 8080;
const TIMEOUT_MS = 1000;

const socket = net.createConnection({ host: HOST, port: PORT });

function fail() {
    console.error(
        [
            '',
            'Release encryption needs the Stallion bridge running in Cavalry.',
            '',
            `Could not connect to http://${HOST}:${PORT}/post, so @scenery/bundler would fail with "fetch failed" during Encrypting.`,
            'Open Cavalry, start Stallion, then run `npm run release` again.',
            ''
        ].join('\n')
    );
    process.exit(1);
}

socket.setTimeout(TIMEOUT_MS);
socket.once('connect', () => {
    socket.end();
});
socket.once('close', (hadError) => {
    process.exit(hadError ? 1 : 0);
});
socket.once('timeout', () => {
    socket.destroy();
    fail();
});
socket.once('error', fail);
