const { Router } = require("express");
const { syncGamesFromPrototype } = require("../syncGames");
const { handleAsync } = require("../helpers/query");

const router = Router();

router.post("/api/sync", handleAsync(async (req, res) => {
  const secret = process.env.SYNC_SECRET;

  if (secret && req.headers["x-sync-secret"] !== secret) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  const result = await syncGamesFromPrototype({ force: true });

  res.json({ ok: true, ...result });
}));

module.exports = router;
