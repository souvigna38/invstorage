# InvStorage — Personal Storage v2 Roadmap

This roadmap outlines the evolution of **InvStorage** from its current containerized inventory foundation into **Personal Storage v2** — a personal digital twin of belongings run like an Amazon Warehouse Management System (WMS), fully local and private.

---

## 1. Vision & Architecture Target

The long-term architecture distributes services across dedicated local hardware without any external cloud dependencies:

- **Node A (RTX 5070 Ti 16GB)**: Local AI compute engine running Ollama (`qwen3-vl`), Faster-Whisper (speech-to-text), and Piper (text-to-speech).
- **Node B (Dual Xeon 768GB RAM)**: Core application host running Home Assistant, PostgreSQL (with pgvector), Frigate NVR, Node-RED, and workflow orchestrators.
- **Node C (60TB NAS)**: High-capacity storage for surveillance clips, photo drop zones, and database backups.
- **Client Devices**: iPhone camera drop sync, Siri / Apple Shortcuts, and Home Assistant Assist voice satellites.

---

## 2. Current Implementation vs. Target Vision

| Capability | Implemented Today (v1.x) | Intended Vision (v2 WMS) |
|---|---|---|
| **Inventory Hierarchy** | Flat locations (`Server Room`, `Garage`, etc.) with basic parent location pointer | Parent-child nested containers (`racket` in `blue duffel` in `BIN_001` in `Van`) with recursive path resolution |
| **Bin / Zone Identifiers** | Free-form location names | Standardized WMS zone & bin tracking (`BIN_001`, `Garage Shelf A`, `Van Trunk`) |
| **Photo Ingestion** | Script scanning `photo-inbox/` with CLIP visual similarity grouping and LLaVA | Automated `ingestion_queue/` folder watched by a Python orchestrator; Ollama (`qwen3-vl`) output enforced via Pydantic JSON schema; moves photos to `archived/` |
| **Pluggable AI & Cloud** | Unified `vision.ts` client supporting real Ollama (`qwen3-vl`/`llava`) and zero-GPU mock fixtures for Cloud VM / CI | Multi-node pipeline using Node A GPU with mock fallbacks for testing |
| **Voice Search** | Browser-based floating mic button with Whisper transcription and CLIP vector search; newly added `/api/locate` API | Natural voice queries ("Where is my badminton gear?") via Apple Shortcuts and Home Assistant Assist (OpenWakeWord, Wyoming, Faster-Whisper, Piper) |
| **Physical Tracking** | Manual check-in / check-out and location transfer UI | Frigate chokepoint cameras (van trunk, front door, storage door) capturing motion-event snapshots to auto-update item direction and location |
| **Sales & Distribution** | Medusa.js backend, n8n multi-marketplace workflows, ERPNext shadow ERP | Retained as secondary resale channel for surplus belongings |

---

## 3. Prioritized Phased Roadmap

### Phase 1: Bin, Item & Container Schema with Parent-Child Moves *(Highest Priority)*
- [ ] **Hierarchical Container Schema**:
  - Add `containers` table: `id`, `code` (e.g. `BIN_001`), `name`, `parent_container_id`, `location_id`, `type` (`shelf`, `bin`, `bag`, `vehicle`).
  - Add `container_id` foreign key on `items`.
- [ ] **Recursive Location Resolution**:
  - Querying an item resolves its full hierarchy path (e.g. `Tennis Racket → Blue Duffel → BIN_001 → Van`).
  - Moving a parent container (e.g. moving `BIN_001` from `Garage Shelf A` to `Van`) automatically updates the effective location of all nested contents.
- [ ] **Container Barcode / QR Generation**:
  - Printable labels for physical bins with instant scan-to-view URL redirect.

### Phase 2: Batch Photo Ingestion with JSON-Schema Validation
- [ ] **Ingestion Queue Watcher**:
  - Monitor `ingestion_queue/` for bin photo drops (e.g. `BIN_001.jpg`).
- [ ] **Pydantic Schema Enforcement with Ollama `qwen3-vl`**:
  - Feed bin photo to `qwen3-vl` with a strict Pydantic model (`bin_id`, `items_detected`, `category`, `quantity`, `tags`, `condition`).
  - Validate output against schema; retry with corrective prompt on parsing errors.
- [ ] **Automated Database Upsert & Archival**:
  - Insert or update items under the matched `bin_id`.
  - Automatically move processed images to `archived/YYYY-MM/`.
- [ ] **Pluggable Test Fixtures**:
  - Retain `fixtures/sample_bins/BIN_001.json` and mock client for non-GPU / CI verification.

### Phase 3: "Where is X?" Fast Voice & Apple Shortcuts API
- [x] **Initial Search Endpoint (`/api/locate`)**:
  - Implemented `/api/locate?q=...` supporting both JSON and `Accept: text/plain` for Apple Shortcuts `Speak Text`.
- [ ] **Hierarchy Speech Synthesis**:
  - Update speech output to include full container breadcrumbs: *"Your badminton gear is in BIN_001 (Garage Shelf A) inside the blue duffel."*
- [ ] **Home Assistant Assist Integration**:
  - Webhook / Wyoming integration for satellite voice satellites (ESP32 / Raspberry Pi mics).
  - Intent recognition for natural language location queries.

### Phase 4: Chokepoint Camera Tracking (Frigate NVR)
- [ ] **Frigate Motion Webhook**:
  - Listen for motion events from chokepoint cameras (Van Trunk, Storage Room Door, Front Door).
- [ ] **Chokepoint Vision Analysis**:
  - Send motion event crop to Ollama to detect known items or bins entering/exiting.
- [ ] **Directional Location Update**:
  - Track transition vectors (e.g. `Garage → Van Trunk`) to automatically update item status.
