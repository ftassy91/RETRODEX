const { Op, col, fn, where: sqlWhere } = require("sequelize");

function parseLimit(value, fallback = 20, max = 100) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function buildGameWhere(query) {
  const where = {};
  const filters = [];
  const type = String(query.type || "game").trim();

  if (query.q) {
    filters.push(
      sqlWhere(fn("LOWER", col("title")), {
        [Op.like]: `%${String(query.q).trim().toLowerCase()}%`,
      })
    );
  }

  if (query.console) {
    where.console = query.console;
  }

  if (type) {
    where.type = type;
  }

  if (filters.length) {
    where[Op.and] = filters;
  }

  return where;
}

function handleAsync(handler) {
  return function asyncRoute(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = { parseLimit, buildGameWhere, handleAsync };
