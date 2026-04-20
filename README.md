# Document Parsing

AI-powered document parsing with a correction-and-save-as-template workflow. Built on Azure AI Document Intelligence.

Two services:

- **`api/`** — ASP.NET Core 10 Web API. Owns Azure Document Intelligence integration, file storage, and SQLite persistence.
- **`web/`** — Next.js 15 (App Router) frontend with Fluent UI v9 + Tailwind. Upload, review, and correct parsed fields.

## Prerequisites

- .NET 10 SDK (you have `10.0.201`)
- Node.js 20+ (you have `25.5.0`) and npm 10+
- Azure Document Intelligence resource (endpoint + key)

## First-time setup

### 1. Configure the API

```bash
cd api
cp appsettings.Development.json.example appsettings.Development.json
```

Then open `api/appsettings.Development.json` and paste your `Endpoint` and `Key`. This file is gitignored.

```bash
dotnet restore
```

### 2. Configure the web app

```bash
cd ../web
cp .env.local.example .env.local
npm install
```

`.env.local` is gitignored. The default `NEXT_PUBLIC_API_BASE_URL` points to `http://localhost:5180` which is where the API listens.

## Running locally

Two terminals:

**Terminal 1 — API** (serves on http://localhost:5180):

```bash
cd api
dotnet run
```

First run creates `api/app.db` (SQLite) automatically.

**Terminal 2 — Web** (serves on http://localhost:3000):

```bash
cd web
npm run dev
```

Open http://localhost:3000 and upload an invoice PDF.

## Project layout

```
document-parsing/
├── api/                       ASP.NET Core Web API
│   ├── Contracts/             Request/response DTOs
│   ├── Controllers/           HTTP endpoints
│   ├── Data/                  EF Core DbContext
│   ├── Models/                Domain entities
│   ├── Services/              Azure DI integration
│   └── Program.cs             Composition root
├── web/                       Next.js 15 app
│   ├── app/                   App Router pages + providers
│   ├── components/            Client components
│   └── lib/                   API client + shared utils
└── README.md
```

## Roadmap

Day 1 (done): upload → Azure DI parse → display fields.
Day 2: PDF viewer with bounding-box overlay, correction UI.
Day 3–4: save corrections, "save as template," re-apply on similar uploads.
Later: Teams tab wrapper, e-signature, compliance verification.
