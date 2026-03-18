require("dotenv").config();

const { sequelize, storagePath, databaseMode, databaseTarget } = require("./database");
const { syncGamesFromPrototype } = require("./syncGames");

async function main() {
  try {
    const result = await syncGamesFromPrototype({ force: true });
    console.log(`RetroDex database synced: ${result.imported} games`);
    if (databaseMode === "postgres") {
      console.log(`PostgreSQL target: ${databaseTarget}`);
    } else {
      console.log(`SQLite file: ${storagePath}`);
    }
  } finally {
    await sequelize.close();
  }
}

main().catch((error) => {
  console.error("Sync failed:", error);
  process.exit(1);
});
