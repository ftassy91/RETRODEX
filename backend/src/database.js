const sequelize = require("../config/database");
const { resolveSqlitePath } = require("../config/database");

const storagePath = resolveSqlitePath();
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
