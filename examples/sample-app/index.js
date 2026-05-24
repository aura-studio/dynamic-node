const os = require("node:os");

const Tunnel = {
  initialized: false,
  closed: false,

  Init() {
    this.initialized = true;
  },

  Invoke(route, request = "{}") {
    const input = JSON.parse(request || "{}");
    return JSON.stringify({
      route,
      message: `hello ${input.name || "dynamic-node"}`,
      initialized: this.initialized,
      platform: os.platform(),
      node: process.version,
    });
  },

  Meta() {
    return JSON.stringify({
      kind: "sample-app",
      methods: ["Init", "Invoke", "Meta", "Close"],
    });
  },

  Close() {
    this.closed = true;
  },
};

function New() {
  return Tunnel;
}

module.exports = { Tunnel, New };
