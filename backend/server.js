const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

const { sequelize } = require("./src/database");
const { startServer } = require("./src/server");

startServer().catch(async (error) => {
  console.error("Unable to start RetroDex backend:", error);
  await sequelize.close();
  process.exit(1);
});
