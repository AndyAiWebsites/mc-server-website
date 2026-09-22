#!/usr/bin/env node
"use strict";

const net = require("net");
const dns = require("dns");
const zlib = require("zlib");

const HOST = process.env.MC_HOST || "della-workload.tun.ply.gg";
const PORT = parseInt(process.env.MC_PORT || "25565", 10);
const TIMEOUT = Number(process.env.MC_TIMEOUT || 6000);

function varintEncode(n) {
  const out = [];
  while (true) {
    let b = n & 0x7f;
    n >>>= 7;
    if (n) out.push(b | 0x80);
    else { out.push(b); break; }
  }
  return Buffer.from(out);
}

function varintNext(buf, start) {
  let num = 0, shift = 0, i = start;
  while (i < buf.length) {
    const v = buf[i++];
    num |= (v & 0x7f) << shift;
    if (!(v & 0x80)) return { value: num, offset: i };
    shift += 7;
  }
  return null;
}

function ping(host, addr, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: addr, port, timeout: TIMEOUT });
    let settled = false;
    let timer = setTimeout(() => finish({ error: "timeout" }), TIMEOUT + 2000);

    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    }

    socket.on("connect", () => {
      const addrBytes = Buffer.from(host, "utf8");
      const hs = Buffer.concat([
        Buffer.from([0x00]), varintEncode(0), varintEncode(addrBytes.length),
        addrBytes, Buffer.from([(port >> 8) & 0xff, port & 0xff]), varintEncode(1),
      ]);
      socket.write(Buffer.concat([varintEncode(hs.length), hs]));
      socket.write(Buffer.from([0x01, 0x00]));
    });

    socket.on("error", (e) => finish({ error: e.message }));
    socket.setTimeout(TIMEOUT, () => finish({ error: "timeout" }));

    let buf = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const packetLen = varintNext(buf, 0);
      if (!packetLen) return;
      const total = packetLen.value + packetLen.offset;
      if (buf.length < total) return;

      let body = buf.slice(packetLen.offset, total);
      const unLen = varintNext(body, 0);
      if (!unLen) return;
      if (unLen.value !== 0) {
        try {
          body = zlib.unzipSync(body.slice(unLen.offset));
        } catch (e) {
          return finish({ error: "bad compressed payload" });
        }
      }
      if (body[0] !== 0x00) return finish({ error: "unexpected packet id" });
      const strLen = varintNext(body, 1);
      if (!strLen) return finish({ error: "bad string length" });

      let raw;
      try {
        raw = body.slice(strLen.offset, strLen.offset + strLen.value).toString("utf8");
      } catch (e) {
        return finish({ error: "bad utf8" });
      }

      let json;
      try {
        json = JSON.parse(raw);
      } catch (e) {
        return finish({ error: "bad json" });
      }

      const desc = json.description;
      const motd = typeof desc === "string" ? desc
        : desc && desc.extra ? desc.extra.map((p) => p.text || "").join("")
        : desc && desc.text ? desc.text : "";

      const players = (json.players || {});
      const sample = Array.isArray(players.sample) ? players.sample : [];
      finish({
        online: true,
        version: (json.version || {}).name || null,
        protocol: (json.version || {}).protocol || null,
        motd: motd && motd.length ? motd.replace(/\u00a7./g, "") : null,
        players: {
          online: players.online || 0,
          max: players.max || 0,
          names: sample.map((p) => p.name || "?"),
        },
      });
    });
  });
}

function lookup() {
  return new Promise((resolve) => {
    dns.lookup(HOST, { all: true, verbatim: true }, (err, addrs) => {
      if (err || !addrs || !addrs.length) resolve([HOST]);
      else resolve(addrs.map((a) => a.address));
    });
  });
}

(async () => {
  const addresses = await lookup();
  let result = null;
  for (const addr of addresses) {
    result = await ping(HOST, addr, PORT);
    if (result.online) {
      result.host = HOST;
      result.address = addr;
      break;
    }
  }
  if (!result) result = { online: false };

  const out = {
    host: HOST,
    port: PORT,
    online: !!result.online,
    updatedAt: new Date().toISOString(),
    version: result.version || null,
    protocol: result.protocol || null,
    motd: result.motd || null,
    players: result.players || { online: 0, max: 0, names: [] },
    error: result.error || null,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
})().catch(() => {
  process.stdout.write(JSON.stringify({ host: HOST, port: PORT, online: false, error: "fatal", updatedAt: new Date().toISOString(), players: { online: 0, max: 0, names: [] } }) + "\n");
  process.exit(0);
});