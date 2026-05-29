const port = process.env.KUBSOME_PORT || 8000;
const target = `http://localhost:${port}`;

module.exports = {
  "/api": { target, secure: false },
  "/ws": { target: `ws://localhost:${port}`, secure: false, ws: true },
};
