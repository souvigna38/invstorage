# InvTrack / InvStorage User Guide

InvTrack is the name shown in the inventory interface. The project and Docker
deployment are also called **InvStorage**. This guide covers day-to-day use of
the inventory application. Installation and server administration remain in
the project [README](../README.md).

## 1. Open and close the system

From the project directory:

```bash
./scripts/start.sh
docker compose ps
```

Wait for the `frontend`, `db`, `redis`, and `storage` services to become
healthy. The CLIP service can take longer because it loads AI models.

Open the main application:

- On the host computer: <http://localhost:3000>
- From another computer on the same network:
  `http://SERVER_LAN_IP:3000`

To stop all services without deleting data:

```bash
./scripts/stop.sh
```

Do not use `docker compose down -v` for routine shutdown. The `-v` option
deletes Docker volumes and their stored data.

## 2. Understand the main screen

The home screen displays inventory cards. Select an item card to open its full
record.

The header provides:

- **invTrack logo** — return to all inventory.
- **Search** — find items by name, asset tag, serial number, or indexed text.
- **Category selector and category bar** — limit the displayed inventory to a
  category. Select the active category again, or select **All Items**, to clear
  the filter.
- **Sales** — open the Medusa sales administration interface.
- **n8n** — open workflow automation.
- **ERP** — open ERPNext.
- **AI** — open the OpenClaw agent interface.
- **Ingest** — process photographs in the photo inbox.

The following controls are currently placeholders or incomplete and should not
be relied on: **History & Logs**, **Reports**, **Transfer** in the header, and
**+ Scan Item**. Location changes work from an individual item's
**Move / Transfer** button.

## 3. Search inventory

### Text and category search

1. Optionally choose a category from the selector beside the search field.
2. Enter a title, manufacturer, asset tag, serial number, or other identifying
   text.
3. Select the magnifying-glass button or press Enter.
4. Select **All Items** to return to the full inventory.

### Voice search

Use the floating voice-search button when it is available in the lower corner
of the page:

1. Allow microphone access when prompted.
2. Speak a description of the item.
3. Stop recording and wait for transcription and matching.

Voice and meaning-based searches depend on the CLIP/Whisper AI service. If they
fail while ordinary text search works, check `clip-service`:

```bash
docker compose ps clip-service
docker compose logs clip-service
```

## 4. Add items with photographs

The currently supported item-creation workflow is the photo inbox. There is no
general-purpose **Add Item** form.

1. Copy JPG, JPEG, PNG, WebP, HEIC, or HEIF photographs into:

   ```text
   photo-inbox/
   ```

2. Use clear photographs with one main item. Multiple views of the same item
   can be added together; the ingest pipeline attempts to group them.
3. Open the inventory application and select **Ingest** in the header.
4. Leave the page open while processing finishes. A status message reports
   items created, photographs grouped, AI labels, merges, and skipped exact
   duplicates.
5. Open each new item and verify its title, category, specifications, serial
   number, value, and location.

Processed files are moved under `photo-inbox/processed/`. AI descriptions are
suggestions and should be reviewed before relying on them or publishing a sale
listing.

If the application reports **No photos in inbox**, confirm that files are in
the project-level `photo-inbox/` directory rather than the `processed/`
subdirectory.

## 5. Review and edit an item

Open an inventory card to see its:

- Images and AI observations
- Manufacturer, model, serial number, and asset tag
- Current status and location
- Purchase cost, estimated value, MSRP, and sales information
- Hardware specifications
- Notes, warranty information, and activity history

Select **Edit Specs** to update the editable record fields. Save changes and
confirm the updated values on the item page.

The **MSRP lookup** feature requires a configured SerpAPI key. Without it, enter
pricing information manually through **Edit Specs**.

AI fields can be corrected from the AI insights section. Corrections may update
the item record, so check the resulting title and specifications.

## 6. Move an item

1. Open the item.
2. Select **Move / Transfer**.
3. Choose the destination location.
4. Add any requested note and confirm the move.
5. Verify that **Current Location** changed.

The transfer is added to the item's activity history. The header-level
**Transfer** page is not currently implemented.

## 7. Print and scan an asset label

Items with an asset tag show **Print Label**:

1. Open the item and select **Print Label**.
2. Use the browser print dialog to print the label and QR code.
3. Attach the label to the physical item.
4. Scan the QR code with a phone connected to a network that can reach the
   InvTrack server.

For labels scanned from other devices, `NEXT_PUBLIC_HOST_IP` must identify a
hostname or IP address those devices can reach. Labels generated with
`localhost` only work on the server itself.

## 8. Merge duplicate records

Merging is destructive: the selected records are consolidated into one record.
Take a snapshot first.

1. On the home screen, select **Snapshot** and wait for confirmation.
2. Select **Select & Merge**.
3. Select two or more duplicate item cards.
4. Select **Merge into One**.
5. Review the preview and choose the values and images that should survive.
6. Confirm the merge.
7. Open the resulting item and check all fields and images.

Cancel before confirmation if the selected records represent separate physical
items.

## 9. Create snapshots and roll back

### Create a snapshot

Select **Snapshot** above the inventory grid. A confirmation reports the number
of items and images saved.

You can also select **Roll Back Date** and then **Take Snapshot Now**.
The deployment schedules an automatic snapshot around midnight while the
required containers are running.

### Restore a snapshot

Rollback replaces current inventory data with older data:

1. Create a fresh snapshot before proceeding.
2. Select **Roll Back Date**.
3. Select a snapshot and review its timestamp, item count, and image count.
4. Select **Restore This Snapshot**.
5. Confirm **Yes, Restore**.
6. Wait for completion and verify several items.

Do not stop the containers or close the browser while a restore is running.

### Snapshot versus portable backup

Vault snapshots support convenient in-application rollback. They are stored in
Docker-managed storage on the same machine and are not a substitute for an
off-machine backup.

The following command updates the bundled SQL dump for the main inventory
database:

```bash
./scripts/backup.sh
```

That script does **not** constitute a complete backup of every service and
Docker volume. In particular, separately protect item images, Vault data,
Medusa, ERPNext, n8n, and other service data before replacing or wiping the
host.

## 10. List an item for sale

Sales features require the Medusa service and any selected n8n workflows to be
configured.

1. Open the item and confirm its title, description, images, condition, and
   pricing.
2. Select **List for Sale**.
3. Enter a positive sale price.
4. Check the SKU. It is derived from the asset tag or item ID and is used for
   ERPNext synchronization.
5. Edit the sale description.
6. Optionally select distribution channels.
7. Select the listing button and wait for success.

The new listing is created in Medusa. Channel selections request n8n
distribution; they do not guarantee that an external marketplace accepted or
published the item. Check n8n executions and the marketplace itself.

For an existing listing, select **Manage Listing** to open Medusa or remove the
listing.

## 11. Service interfaces

Default local addresses are:

| Interface | Address | Purpose |
|---|---|---|
| Inventory | <http://localhost:3000> | Main user interface |
| MinIO | <http://localhost:9001> | Image storage administration |
| Medusa | <http://localhost:9500/app> | Sales catalog administration |
| n8n | <http://localhost:5678> | Workflow automation |
| ERPNext | <http://localhost:8090> | ERP and accounting |
| Ingestion API | <http://localhost:8085/dashboard> | Data-lake ingestion |
| NocoDB | <http://localhost:8086> | Data-lake spreadsheet interface |
| Adminer | <http://localhost:8080> | Main database administration |
| OpenClaw | <http://localhost:18789> | AI agent gateway |

Database, object-storage, automation, and ERP administration can cause data
loss. Use those interfaces only when you understand the affected service.

## 12. Troubleshooting

### The site does not open

```bash
docker info
docker compose ps
docker compose logs frontend
```

Start Docker if `docker info` fails, then run `./scripts/start.sh`.

### Photographs do not ingest

```bash
docker compose logs frontend
docker compose logs ai-worker
docker compose logs ollama
docker compose logs clip-service
```

Confirm the file format and inbox location. AI services can take several
minutes to become ready after a cold start.

### Images are missing

```bash
docker compose ps storage
docker compose logs storage
```

Confirm that MinIO is healthy and that the browser can reach the configured
public MinIO address.

### Sales publishing fails

```bash
docker compose ps medusa n8n redis
docker compose logs medusa
docker compose logs n8n
```

Confirm Medusa login and marketplace/n8n credentials before retrying.

### A feature appears to do nothing

The header controls **History & Logs**, **Reports**, **Transfer**, and
**+ Scan Item** are currently incomplete. Use the item activity section,
item-level **Move / Transfer**, and photo inbox workflows instead.

## 13. Security and safe operation

- The application contains personal inventory, locations, serial numbers, and
  possibly item photographs. Do not expose it publicly without access control.
- Replace all default passwords before allowing network or internet access.
- Keep database and administration ports private.
- Store API keys only in `.env`; never commit that file.
- Take a snapshot before bulk merges, AI corrections, or rollback.
- Keep an off-machine backup before upgrades or destructive Docker commands.

