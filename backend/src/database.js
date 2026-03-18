const path = require("path");
const { Sequelize } = require("sequelize");

const storagePath = process.env.SQLITE_STORAGE
  ? path.resolve(process.cwd(), process.env.SQLITE_STORAGE)
  : path.resolve(__dirname, "..", "storage", "retrodex.sqlite");
const postgresSchema = process.env.PGSCHEMA || "";

function getSslOption() {
  const sslMode = String(process.env.PGSSLMODE || "disable").toLowerCase();
  if (!sslMode || sslMode === "disable" || sslMode === "false" || sslMode === "0") {
    return null;
  }

  return {
    require: true,
    rejectUnauthorized: false,
  };
}

function buildPostgresConfig() {
  if (process.env.DATABASE_URL) {
    return {
      mode: "postgres",
      target: postgresSchema
        ? `${process.env.DATABASE_URL}#${postgresSchema}`
        : process.env.DATABASE_URL,
      sequelize: new Sequelize(process.env.DATABASE_URL, {
        dialect: "postgres",
        logging: false,
        dialectOptions: getSslOption() ? { ssl: getSslOption() } : {},
        define: postgresSchema ? { schema: postgresSchema } : {},
      }),
    };
  }

  if (!process.env.PGHOST && !process.env.PGDATABASE && !process.env.PGUSER) {
    return null;
  }

  const host = process.env.PGHOST || "localhost";
  const port = Number(process.env.PGPORT || 5432);
  const database = process.env.PGDATABASE || "retrodex";
  const username = process.env.PGUSER || "postgres";
  const password = process.env.PGPASSWORD || "";

  return {
    mode: "postgres",
    target: postgresSchema ? `${host}:${port}/${database}#${postgresSchema}` : `${host}:${port}/${database}`,
    sequelize: new Sequelize({
      dialect: "postgres",
      host,
      port,
      database,
      username,
      password,
      logging: false,
      dialectOptions: getSslOption() ? { ssl: getSslOption() } : {},
      define: postgresSchema ? { schema: postgresSchema } : {},
    }),
  };
}

const postgresConfig = buildPostgresConfig();
const databaseMode = postgresConfig?.mode || "sqlite";
const databaseTarget = postgresConfig?.target || storagePath;

const sequelize = postgresConfig?.sequelize || new Sequelize({
  dialect: "sqlite",
  storage: storagePath,
  logging: false,
});

module.exports = {
  databaseMode,
  databaseTarget,
  postgresSchema,
  sequelize,
  storagePath,
};
