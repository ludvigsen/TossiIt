# AI Life OS ("The Dump")

A "Second Brain" mobile application that accepts unstructured data "dumps" (screenshots, text, voice), processes them using Google Gemini 1.5 Flash (or 3.0 Preview), and organizes them into a structured internal calendar/reminder system with Google Workspace integration.

## Project Architecture

### Frontend (React Native + Expo)
- **Framework**: React Native with Expo (Managed Workflow).
- **Language**: TypeScript.
- **Navigation**: Tab-based (Capture, Inbox, Calendar).
- **Key Features**:
  - **Capture Screen**: Text input and Image picker to send raw dumps to the backend.
  - **Smart Inbox**: Review AI-processed suggestions. Confirming moves them to the calendar.
  - **Calendar**: View finalized events.
  - **Daily Briefing**: Displays an AI-generated summary of upcoming events and recent notes.

### Backend (Node.js)
- **Runtime**: Node.js.
- **Framework**: Express.js.
- **Language**: TypeScript.
- **Database**: PostgreSQL with `pgvector` extension for RAG (Retrieval-Augmented Generation).
- **AI**: Google Generative AI SDK (Gemini).
- **Key Services**:
  - `/api/dump`: Ingests raw text/images.
  - **Processor**: Async worker that extracts structured data (JSON) from dumps using Gemini.
  - **Memory (RAG)**: uses vector embeddings to find similar past dumps for context.
  - **Conflict Checker**: Checks Google Calendar for availability (Mocked).
  - **Summary**: Generates daily briefings.

## Setup Instructions

### Prerequisites
- Node.js & npm
- PostgreSQL database
- Google Gemini API Key

### Backend Setup
1. Navigate to `backend`:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure Environment:
   Copy `env.example` to `.env` and fill in your details:
   ```bash
   cp env.example .env
   ```
   - Set `GEMINI_API_KEY`.
   - Set `DATABASE_URL`.
4. Initialize Database:
   Run the SQL script in `schema.sql` against your Postgres database to create tables and the vector extension.
5. Start Server:
   ```bash
   npm start
   ```

### Frontend Setup
1. Navigate to `frontend`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start Expo:
   ```bash
   npm start
   ```
   - Press `i` to run on iOS Simulator.
   - Press `a` to run on Android Emulator.

## Project Status

### Completed ✅
- [x] **Project Structure**: Monorepo-style setup with `frontend` and `backend`.
- [x] **Database Schema**: Users, Raw Dumps, Smart Inbox, Events tables defined.
- [x] **Vector Support**: `pgvector` extension enabled.
- [x] **Backend API**:
    - [x] File Uploads (Multer).
    - [x] Dump Ingestion Endpoint.
    - [x] Smart Inbox Endpoints.
    - [x] Events/Calendar Endpoints.
- [x] **AI Integration**:
    - [x] Gemini Prompt Engineering for JSON extraction.
    - [x] RAG Pipeline (Embedding generation + Vector Search).
    - [x] Daily Summary Generation.
- [x] **Frontend App**:
    - [x] Expo TypeScript Setup.
    - [x] Capture Screen (Text + Image).
    - [x] Inbox Screen (Review & Confirm).
    - [x] Calendar Screen (List View).
    - [x] Navigation (Tabs).

### Remaining Tasks 📝
- [ ] **Infrastructure**:
    - [ ] Set up a real Cloud Storage bucket (AWS S3 or Supabase Storage) instead of local uploads.
    - [ ] Deploy PostgreSQL database (e.g., Supabase, Neon, or RDS).
- [ ] **Google Integration**:
    - [ ] Register Google Cloud Project.
    - [ ] Implement real OAuth2 flow on Frontend (Google Sign-In) to get tokens.
    - [ ] Replace Mock Calendar/Gmail logic with real Google APIs using the user's token.
- [ ] **Refinement**:
    - [ ] Handle "voice" dumps (Audio to Text transcription via Whisper or Gemini).
    - [ ] Improve RAG context window logic.
    - [ ] Add Edit modal for Inbox items.

