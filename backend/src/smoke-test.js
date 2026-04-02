require("dotenv").config();

const { sequelize } = require("./database");
const { startServer } = require("./server");
const CollectionItem = require("./models/CollectionItem");

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
  }

  return response.text();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
}

async function deleteJson(url) {
  const response = await fetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
}

function hasAnyMarker(source, markers = []) {
  return markers.some((marker) => source.includes(marker));
}

async function main() {
  const port = Number(process.env.SMOKE_PORT || 3100);
  const server = await startServer(port);
  const baseUrl = `http://127.0.0.1:${port}`;
  const smokeGameId = "tetris-game-boy";
  let createdCollectionItemId = null;

  try {
    const root = await fetchJson(`${baseUrl}/`);
    const health = await fetchJson(`${baseUrl}/api/health`);
    const beginnerGames = await fetchJson(`${baseUrl}/games?console=Game%20Boy&limit=2`);
    const beginnerSearch = await fetchJson(`${baseUrl}/games?q=zelda&limit=2`);
    const beginnerDetail = await fetchJson(`${baseUrl}/games/tetris-game-boy`);
    const games = await fetchJson(`${baseUrl}/api/games?console=Game%20Boy&limit=3`);
    const backendSearch = await fetchJson(`${baseUrl}/api/games?q=zelda&limit=2`);
    const detail = await fetchJson(`${baseUrl}/api/games/${smokeGameId}`);
    const summary = await fetchJson(`${baseUrl}/api/games/${smokeGameId}/summary`);
    const random = await fetchJson(`${baseUrl}/api/games/random?console=Game%20Boy`);
    const consoles = await fetchJson(`${baseUrl}/api/consoles`);
    const initialCollection = await fetchJson(`${baseUrl}/api/collection`);

    if ((initialCollection.items || []).some((item) => String(item?.gameId || item?.id) === smokeGameId)) {
      await deleteJson(`${baseUrl}/api/collection/${smokeGameId}`);
    }

    const collectionBefore = await fetchJson(`${baseUrl}/api/collection`);
    const createdCollectionItem = await postJson(`${baseUrl}/api/collection`, {
      gameId: smokeGameId,
      condition: "Loose",
      notes: "Smoke test insert",
    });
    createdCollectionItemId = createdCollectionItem.item?.id ?? createdCollectionItem.item?.gameId ?? smokeGameId;
    const collectionAfter = await fetchJson(`${baseUrl}/api/collection`);
    const deletedCollectionItem = await deleteJson(
      `${baseUrl}/api/collection/${createdCollectionItemId}`
    );
    createdCollectionItemId = null;
    const collectionAfterDelete = await fetchJson(`${baseUrl}/api/collection`);
    const homePage = await fetchText(`${baseUrl}/home.html`);
    const collectionPage = await fetchText(`${baseUrl}/collection.html`);
    const consolesPage = await fetchText(`${baseUrl}/consoles.html`);
    const debugPage = await fetchText(`${baseUrl}/debug.html`);
    const gamesListPage = await fetchText(`${baseUrl}/games-list.html`);
    const gameDetailPage = await fetchText(`${baseUrl}/game-detail.html?id=${smokeGameId}`);

    console.log(
      JSON.stringify(
        {
          rootMessage: root.message,
          health,
          beginnerRouteCount: beginnerGames.length,
          beginnerSearchCount: beginnerSearch.length,
          beginnerSearchFirst: beginnerSearch[0]?.title ?? null,
          beginnerDetailTitle: beginnerDetail.title,
          gameCount: games.total,
          returnedCount: games.returned,
          firstGame: games.items[0]?.title ?? null,
          backendSearchCount: backendSearch.returned,
          backendSearchFirst: backendSearch.items[0]?.title ?? null,
          detailTitle: detail.title,
          summaryTitle: summary.item?.title ?? null,
          randomTitle: random.title,
          consolesCount: consoles.items.length,
          collectionCountBefore: collectionBefore.total,
          collectionCreatedId: createdCollectionItem.item?.id ?? createdCollectionItem.item?.gameId ?? smokeGameId,
          collectionCountAfter: collectionAfter.total,
          collectionDeletedId: deletedCollectionItem.deletedId ?? null,
          collectionCountAfterDelete: collectionAfterDelete.total,
          homePageReady: hasAnyMarker(homePage, [
            "RETRODEX HOME SHELL",
            "RetroDex - Home Shell",
          ]),
          collectionPageReady: hasAnyMarker(collectionPage, [
            "RetroDex - Ma collection",
            "MA COLLECTION",
          ]),
          consolesPageReady: hasAnyMarker(consolesPage, [
            "RetroDex - Consoles",
            "RETRODEX HARDWARE",
          ]),
          debugPageReady: hasAnyMarker(debugPage, [
            "RETRODEX DEBUG SURFACE",
            "RetroDex - Debug Surface",
          ]),
          gamesListReady: hasAnyMarker(gamesListPage, [
            "RETRODEX CATALOGUE",
            "RetroDex - Catalogue",
          ]),
          gameDetailReady: hasAnyMarker(gameDetailPage, [
            "RetroDex &mdash; Fiche jeu",
            "id=\"hero\" class=\"hero-card\"",
          ]),
        },
        null,
        2
      )
    );
  } finally {
    if (createdCollectionItemId) {
      await CollectionItem.destroy({
        where: {
          id: createdCollectionItemId,
        },
      });
    }

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    await sequelize.close();
  }
}

main().catch((error) => {
  console.error("Smoke test failed:", error);
  process.exit(1);
});
