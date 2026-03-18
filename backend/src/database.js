const path = require("path");
const sequelize = require("../config/database");

const configuredSqlitePath = process.env.RETRODEX_SQLITE_PATH
  || path.resolve(__dirname, "../../backend/storage/retrodex.sqlite");
const storagePath = path.isAbsolute(configuredSqlitePath)
  ? configuredSqlitePath
  : path.resolve(__dirname, "..", "..", configuredSqlitePath);
const postgresSchema = process.env.PGSCHEMA || "";
const databaseMode = process.env.DATABASE_URL ? "postgres" : "sqlite";
const databaseTarget = process.env.DATABASE_URL
  ? (process.env.DATABASE_URL.includes("@") ? process.env.DATABASE_URL.split("@")[1] : process.env.DATABASE_URL)
  : storagePath;

module.exports = {
  databaseMode,
  databaseTarget,
  postgresSchema,
  sequelize,
  storagePath,
};
