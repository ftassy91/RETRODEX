const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

const { sequelize } = require("./src/database");
const { startServer } = require("./src/server");
const PORT = process.env.PORT || 3000;

startServer(PORT).catch(async (error) => {
  console.error("Unable to start RetroDex backend:", error);
  await sequelize.close();
  process.exit(1);
});
