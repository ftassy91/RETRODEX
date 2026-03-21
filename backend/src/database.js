const sequelize = require("../config/database");
const { resolveSqlitePath } = require("../config/database");

const storagePath = resolveSqlitePath();
const postgresSchema = process.env.PGSCHEMA || "";
const usePostgres = process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL);
const databaseMode = usePostgres ? "postgres" : "sqlite";
const databaseTarget = usePostgres
  ? (process.env.DATABASE_URL.includes("@") ? process.env.DATABASE_URL.split("@")[1] : process.env.DATABASE_URL)
  : storagePath;

module.exports = {
  databaseMode,
  databaseTarget,
  postgresSchema,
  sequelize,
  storagePath,
};
