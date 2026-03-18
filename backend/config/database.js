const { Sequelize } = require("sequelize");
const path = require("path");

function resolveSqlitePath() {
  const configuredPath = process.env.RETRODEX_SQLITE_PATH
    || path.resolve(__dirname, "../../backend/storage/retrodex.sqlite");

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(__dirname, "../..", configuredPath);
}

function createSequelize() {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    const target = dbUrl.includes("@") ? dbUrl.split("@")[1] : dbUrl;
    console.log("[DB] Using PostgreSQL:", target);
    return new Sequelize(dbUrl, {
      dialect: "postgres",
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
      logging: false,
    });
  }

  const sqlitePath = resolveSqlitePath();
  console.log("[DB] Using SQLite:", sqlitePath);
  return new Sequelize({
    dialect: "sqlite",
    storage: sqlitePath,
    logging: false,
  });
}

const sequelize = createSequelize();

module.exports = sequelize;
module.exports.createSequelize = createSequelize;
module.exports.resolveSqlitePath = resolveSqlitePath;
