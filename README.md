# VERRACT

> Google Drive verification and migration engine for structured filesystem orchestration.

VERRACT adalah engine untuk proses:
- verifikasi aset digital
- resolusi struktur filesystem
- validasi lokasi fisik aset
- penguncian identitas filesystem berbasis ID
- dan orkestrasi migrasi aset Google Drive

yang dibangun menggunakan Google Apps Script dan Google Sheets.

Project ini bukan sistem DAM (Digital Asset Management) penuh.

Sebaliknya, VERRACT dirancang sebagai:

```text
filesystem orchestration engine
```

yang bisa dipakai oleh berbagai framework atau workflow lain di atasnya.

Contohnya:
- Design Files Management
- Asset Migration System
- Archive Consolidation
- Multi-Drive Sync Workflow
- Taxonomy Refactoring
- Folder Structure Rebuild
- dan workflow filesystem lain yang membutuhkan validasi serta orkestrasi aset skala besar.

---

# Core Philosophy

VERRACT dibangun menggunakan pendekatan bertahap:

```text
VERIFY → RESOLVE → ID → ACTION
```

## VERIFY

Memverifikasi keberadaan fisik aset.

## RESOLVE

Menentukan kondisi logis dan lokasi aktual aset.

## ID

Mengunci identitas filesystem menggunakan:
- FileID
- FolderID
- ParentID

## ACTION

Melakukan mutasi filesystem secara aman dan terkontrol.

---

# Why VERRACT Exists

Filesystem besar hampir selalu mengalami:
- migrasi bertingkat
- struktur folder tidak konsisten
- perubahan taxonomy
- duplicate path
- orphan assets
- folder relic
- dan fragmentasi historis.

Semakin besar library aset,
semakin filesystem berubah menjadi:

```text
arsip sejarah keputusan manusia
```

bukan sekadar kumpulan folder.

VERRACT dibuat untuk membantu sistem tetap bisa:
- diaudit
- dipetakan
- diverifikasi
- dan dimigrasikan

tanpa kehilangan referensi terhadap realitas fisik aset.

---

# Current Project Status

Saat ini VERRACT masih berada di fase awal pengembangan.

## Current Focus

- Folder verification
- RootID traversal
- Path resolution
- Multi-account filesystem validation
- Batch orchestration
- Cache optimization
- Migration preparation

## Not Yet Implemented

- File-level orchestration
- Rename engine
- Move engine
- Rollback system
- Sync monitoring
- Conflict resolution
- Action pipeline

---

# Current Architecture

Saat ini VERRACT masih bekerja terutama di level:

- folder verification
- path traversal
- filesystem resolution
- root-scoped lookup
- identity locking

Belum masuk penuh ke:
- file orchestration
- synchronization layer
- migration execution engine
- monitoring subsystem

---

# Design Principles

VERRACT dirancang untuk:
- lightweight
- scalable
- spreadsheet-driven
- multi-account aware
- migration-safe
- audit-friendly

tanpa ketergantungan terhadap:
- external server
- enterprise infrastructure
- proprietary DAM platform

---

# Technology Stack

- Google Apps Script (GAS)
- Google Sheets
- DriveApp
- ScriptCache
- LockService
- Time-based Trigger

---

# Long-Term Direction

VERRACT tidak dirancang untuk menjadi aplikasi.

VERRACT dirancang untuk menjadi:

```text
filesystem engine layer
```

yang dapat digunakan oleh berbagai sistem manajemen aset dan workflow migrasi digital.

---

# Notes

Project ini masih aktif berkembang.

Beberapa bagian kemungkinan akan berubah seiring evolusi:
- filesystem architecture
- taxonomy strategy
- migration pipeline
- orchestration model
- dan monitoring layer.

Karena ternyata mengelola puluhan ribu aset digital lintas struktur dan akun bukan proses yang sederhana.

Mengejutkan sekali.

---

# Status

🚧 Active Development
