const service = require("@aura-studio/service-node");

class ExampleService {
  meta() {
    return {
      kind: "service-app",
      routes: ["/greet-user", "/echo"],
    };
  }

  greetUser(ctx, payload = {}) {
    ctx.setResponseMeta("handler", "greetUser");
    return {
      message: `hello ${payload.name || "service-node"}`,
      route: ctx.route,
    };
  }

  echo(ctx, payload) {
    ctx.setResponseMeta("handler", "echo");
    return payload;
  }
}

const app = new ExampleService();
const Tunnel = service.new(app);

function New() {
  return service.new(app);
}

module.exports = { app, Tunnel, New };
