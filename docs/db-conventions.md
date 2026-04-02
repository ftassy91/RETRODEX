# RetroDex DB Conventions

This document defines the baseline conventions for the RetroDex Sequelize and SQL schema.

## Naming rules

- All Sequelize model files use PascalCase, for example `Game.js`, `Console.js`, `CollectionItem.js`.
- All database column names use `snake_case` in SQL.
- All Sequelize attribute names use `camelCase` when the model exposes a JavaScript alias.
- All foreign keys use the `<entity>Id` form in Sequelize, for example `consoleId`, `developerId`, `gameId`.

## Primary keys

- Every table must have a primary key named `id`, except for legacy bridge tables that must be migrated later.
- Primary keys may be integer or string depending on the entity.
- Integer primary keys should use auto-increment when appropriate.

## Nullability

- Every mandatory field must declare `allowNull: false` in the Sequelize model.
- Optional fields must declare `allowNull: true` explicitly when clarity is needed.
- Fields with a default value should still declare `allowNull: false` when the value is required by the domain.

## Uniqueness

- Any field used as an identifier, slug, or URL key must have a unique constraint.
- Composite uniqueness must be declared with an index when the business key spans multiple columns.

## Associations

- All associations must be declared in one central associations file.
- Associations must never be declared inside route files.
- Foreign key constraints should be expressed with Sequelize `references` or association-generated references whenever possible.

## Mapping rules

- SQL table names use plural `snake_case`.
- Sequelize model names use singular PascalCase.
- When an SQL column stays in `snake_case`, expose it through Sequelize with a `camelCase` attribute plus `field: 'snake_case_name'`.

