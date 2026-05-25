# AgroMind AI Backend

Production-minded Node.js API for AgroMind AI, using Express, PostgreSQL, Prisma, and JWT authentication.

## Database Architecture

The backend uses PostgreSQL as the real database and Prisma as the database toolkit.

```text
users
  owns many farms
  creates many crop_scans

farms
  belongs to one user
  has many crop_scans

crop_scans
  belongs to one user
  optionally belongs to one farm
```

This gives AgroMind a clean starting structure:

- `users`: farmers, agronomists, and admins who log in.
- `farms`: land records owned by users.
- `crop_scans`: AI crop analysis records created by users.

## Environment Variables

Create `server/.env` from `server/.env.example`:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL="postgresql://postgres:password@localhost:5432/agromind_ai?schema=public"
JWT_SECRET="replace-this-with-a-long-random-secret"
JWT_EXPIRES_IN="7d"
CLIENT_URL="http://localhost:8081"
GEMINI_API_KEY="your-gemini-api-key"
AI_PROVIDER="auto"
AI_SERVICE_URL="http://127.0.0.1:8000"
OPENWEATHER_API_KEY="your-openweather-api-key"
```

`DATABASE_URL` tells Prisma how to reach PostgreSQL:

```text
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

For local development, create a PostgreSQL database named `agromind_ai`.

`AI_PROVIDER=auto` sends crop scans to the Python TensorFlow service first and
falls back to Gemini if the local service is unavailable. Use `AI_PROVIDER=python`
when you want scans to fail instead of falling back, or `AI_PROVIDER=gemini` to
skip the Python service.

## Setup

Install dependencies:

```bash
npm install
```

Generate Prisma Client:

```bash
npm run prisma:generate
```

Create the PostgreSQL tables from the migration:

```bash
npm run prisma:migrate
```

Open Prisma Studio to inspect database rows visually:

```bash
npm run prisma:studio
```

Run the API:

```bash
npm run dev
```

## Prisma Commands

- `npm run prisma:generate`: rebuilds the Prisma Client after schema changes.
- `npm run prisma:migrate`: creates or applies a development migration.
- `npm run prisma:deploy`: applies committed migrations in production.
- `npm run prisma:reset`: drops local data and rebuilds the database. Use only in development.
- `npm run prisma:studio`: opens a browser UI for viewing and editing rows.

## Prisma Models

A Prisma model is a JavaScript-friendly description of a database table.

Example:

```prisma
model User {
  id           String   @id @default(uuid()) @db.Uuid
  fullName     String   @map("full_name")
  email        String   @unique
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@map("users")
}
```

Important parts:

- `model User`: Prisma model name used in code as `prisma.user`.
- `@@map("users")`: actual PostgreSQL table name.
- `@map("full_name")`: actual PostgreSQL column name.
- `@unique`: no two users can share the same email.
- `@updatedAt`: Prisma updates the timestamp whenever the row changes.

## PostgreSQL Basics

PostgreSQL stores data in tables. A table is like a spreadsheet with strict rules:

- A table stores one type of thing, like `users` or `farms`.
- A row is one record, like one user.
- A column is one field, like `email`.
- A data type controls what can be stored, like `TEXT`, `UUID`, or `TIMESTAMP`.

Production practice: keep secrets in `.env`, do not commit `.env`, commit migrations, and run migrations before starting the production app.

## Primary Keys

A primary key is the unique ID for a row.

In this project, every main table uses a UUID primary key:

```prisma
id String @id @default(uuid()) @db.Uuid
```

UUIDs are safer for public APIs than simple numbers because users cannot easily guess the next record ID.

## Foreign Keys

A foreign key connects one table to another.

In `Farm`, this field says every farm must belong to a user:

```prisma
ownerId String @map("owner_id") @db.Uuid
owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade)
```

That means `farms.owner_id` points to `users.id`.

`onDelete: Cascade` means if a user is deleted, their farms are deleted too. `CropScan.farm` uses `onDelete: SetNull`, so if a farm is deleted, the scan history can remain.

## Relationships

Relationships describe how records connect:

- One user has many farms: `User.farms`.
- One farm belongs to one user: `Farm.owner`.
- One user has many crop scans: `User.cropScans`.
- One crop scan optionally belongs to one farm: `CropScan.farm`.

Prisma lets you query across relationships:

```js
const userWithFarms = await prisma.user.findUnique({
  where: { id: userId },
  include: { farms: true },
});
```

## Migrations

A migration is a versioned database change. It is how the team moves from one database shape to the next safely.

This project has an initial migration at:

```text
prisma/migrations/20260508181500_init/migration.sql
```

Development flow:

```bash
npm run prisma:migrate
```

Production flow:

```bash
npm run prisma:deploy
```

Production practice: never use `prisma migrate reset` on a real production database because it deletes data.

## API Routes

Base URL:

```text
/api/v1
```

Health check:

```text
GET /api/v1/health
```

Register:

```text
POST /api/v1/auth/register
```

```json
{
  "fullName": "Agro Farmer",
  "email": "farmer@example.com",
  "password": "password123"
}
```

Login:

```text
POST /api/v1/auth/login
```

```json
{
  "email": "farmer@example.com",
  "password": "password123"
}
```

Get current user:

```text
GET /api/v1/auth/me
Authorization: Bearer <token>
```

Live weather:

```text
GET /api/v1/weather/current?lat=28.6139&lon=77.2090
Authorization: Bearer <token>
```

The weather endpoint keeps the OpenWeather API key on the server. The mobile app sends only latitude and longitude, then the backend calls OpenWeather, normalizes temperature, humidity, rain, wind, and condition data, and returns farming insights such as rain alerts, heat warnings, and field-work suggestions.
