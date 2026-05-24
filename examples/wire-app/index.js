const http = require("node:http");
const wire = require("@aura-studio/wire-node");

const app = (req, res) => {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({
    message: "hello wire-node",
    method: req.method,
    url: req.url,
    target: req.headers["x-dynamic-node-target"] || "",
  }));
};

const server = http.createServer(app);
const Tunnel = wire.new(app);

function New() {
  return wire.new(app);
}

module.exports = { app, server, Tunnel, New };
