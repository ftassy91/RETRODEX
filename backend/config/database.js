const { Sequelize } = require("sequelize");
const path = require("path");
const pg = require("pg");

function resolveSqlitePath() {
  const configuredPath = process.env.RETRODEX_SQLITE_PATH;

  if (!configuredPath) {
    return path.resolve(__dirname, "../storage/retrodex.sqlite");
  }

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(__dirname, "../..", configuredPath);
}

function createSequelize() {
  const isProduction = !!process.env.DATABASE_URL;
  const dbUrl = process.env.DATABASE_URL;

  if (isProduction) {
    const target = dbUrl.includes("@") ? dbUrl.split("@")[1] : dbUrl;
    console.log("[DB] Using PostgreSQL:", target);
    return new Sequelize(dbUrl, {
      dialect: "postgres",
      dialectModule: pg,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
      logging: false,
      define: {
        underscored: true,
      },
    });
  }

  const sqlitePath = resolveSqlitePath();
  console.log("[DB] Using SQLite:", sqlitePath);
  return new Sequelize({
    dialect: "sqlite",
    storage: sqlitePath,
    logging: false,
    define: {
      underscored: true,
    },
  });
}

const sequelize = createSequelize();

module.exports = sequelize;
module.exports.createSequelize = createSequelize;
module.exports.resolveSqlitePath = resolveSqlitePath;
