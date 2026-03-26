'use strict'

const Company = require('./Company')
const Console = require('./Console')
const Game = require('./Game')
const Genre = require('./Genre')
const SubGenre = require('./SubGenre')
const GameGenre = require('./GameGenre')
const Region = require('./Region')
const GameRegion = require('./GameRegion')
const CollectionItem = require('./CollectionItem')
const MarketplaceListing = require('./MarketplaceListing')

Game.belongsTo(Company, {
  foreignKey: 'developerId',
  as: 'developerCompany',
})

Game.belongsTo(Company, {
  foreignKey: 'publisherId',
  as: 'publisherCompany',
})

Company.hasMany(Game, {
  foreignKey: 'developerId',
  as: 'developedGames',
})

Company.hasMany(Game, {
  foreignKey: 'publisherId',
  as: 'publishedGames',
})

Game.belongsTo(Console, {
  foreignKey: 'consoleId',
  as: 'consoleData',
})

Console.hasMany(Game, {
  foreignKey: 'consoleId',
  as: 'games',
})

Game.belongsToMany(Genre, {
  through: GameGenre,
  foreignKey: 'gameId',
  otherKey: 'genreId',
  as: 'genres',
})

Genre.belongsToMany(Game, {
  through: GameGenre,
  foreignKey: 'genreId',
  otherKey: 'gameId',
  as: 'games',
})

SubGenre.belongsTo(Genre, {
  foreignKey: 'genreId',
  as: 'parentGenre',
})

Genre.hasMany(SubGenre, {
  foreignKey: 'genreId',
  as: 'subGenres',
})

Game.belongsToMany(Region, {
  through: GameRegion,
  foreignKey: 'gameId',
  otherKey: 'regionCode',
  as: 'regions',
})

Region.belongsToMany(Game, {
  through: GameRegion,
  foreignKey: 'regionCode',
  otherKey: 'gameId',
  as: 'games',
})

CollectionItem.belongsTo(Game, {
  foreignKey: 'gameId',
  targetKey: 'id',
  as: 'game',
})

Game.hasMany(CollectionItem, {
  foreignKey: 'gameId',
  sourceKey: 'id',
  as: 'collectionItems',
})

MarketplaceListing.belongsTo(Game, {
  foreignKey: 'gameId',
  as: 'game',
})

Game.hasMany(MarketplaceListing, {
  foreignKey: 'gameId',
  as: 'listings',
})
