# VERRACT

> Google Drive verification, resolution, and migration orchestration engine for structured filesystem workflows.

VERRACT adalah engine untuk proses:

* verifikasi aset digital
* resolusi struktur filesystem
* validasi lokasi fisik aset
* penguncian identitas filesystem berbasis ID
* perencanaan action filesystem
* dan orkestrasi migrasi aset Google Drive

yang dibangun menggunakan Google Apps Script dan Google Sheets.

Project ini bukan sistem DAM (Digital Asset Management) penuh.

Sebaliknya, VERRACT dirancang sebagai:

```text
filesystem orchestration engine
```

yang bisa dipakai oleh berbagai framework atau workflow lain di atasnya.

Contohnya:

* Design Files Management
* Asset Migration System
* Archive Consolidation
* Multi-Drive Sync Workflow
* Taxonomy Refactoring
* Folder Structure Rebuild
* dan workflow filesystem lain yang membutuhkan validasi serta orkestrasi aset skala besar.

---

# Core Philosophy

VERRACT dibangun menggunakan pendekatan bertahap:

```text
VERIFY → RESOLVE → ID → ACTION
```

## VERIFY

Memverifikasi keberadaan fisik aset berdasarkan root, path, filename, dan konfigurasi input yang dipilih user.

## RESOLVE

Menentukan kondisi logis dan lokasi aktual aset ketika Verify tidak menghasilkan object yang dapat digunakan.

## ID

Mengunci identitas filesystem menggunakan:

* FileID
* FolderID
* ParentID
* ResolvedID

## ACTION

Menyusun rencana mutasi filesystem secara aman dan terkontrol.

Pada versi saat ini, ACTION masih berjalan dalam mode:

```text
dry-run only
```

Belum ada mutasi nyata terhadap Google Drive.

---

# Why VERRACT Exists

Filesystem besar hampir selalu mengalami:

* migrasi bertingkat
* struktur folder tidak konsisten
* perubahan taxonomy
* duplicate path
* orphan assets
* folder relic
* dan fragmentasi historis

Semakin besar library aset, semakin filesystem berubah menjadi:

```text
arsip sejarah keputusan manusia
```

bukan sekadar kumpulan folder.

VERRACT dibuat untuk membantu sistem tetap bisa:

* diaudit
* dipetakan
* diverifikasi
* diselesaikan
* direncanakan
* dan dimigrasikan

tanpa kehilangan referensi terhadap realitas fisik aset.

---

# Current Project Status

Current version:

```text
v0.5.0
Multi-Phase Dry-Run Orchestration
```

Current status:

```text
dry-run only
no Google Drive mutation
```

VERRACT saat ini sudah mendukung:

```text
VERIFY
→ RESOLVE
→ ACTION PREVIEW
```

dalam satu pipeline multi-phase yang resumable.

## Current Focus

* File and folder verification
* RootID traversal
* Path resolution
* Object identity locking
* Multi-account filesystem validation
* Batch orchestration
* Action planning
* Pipeline status reporting
* Migration preparation
* Execution safety foundation

---

# Multi-Phase Workflow

Multi-Phase menjalankan flow per row:

```text
VERIFY
├─ verified object available
│  └─ ACTION PREVIEW
│
└─ verify failed
   └─ RESOLVE
      ├─ one object found
      │  └─ ACTION PREVIEW
      │
      └─ unresolved or ambiguous
         └─ FINAL STATUS
```

Source object dipilih dengan prioritas:

```text
1. Verified FileID atau PathID
2. ResolvedID
3. No Action
```

Jika source object tidak tersedia, Action Preview tidak dijalankan.

---

# Action Preview

Action Preview menggunakan model input:

```text
SourceObjectID
Operation
Target
```

Supported operations:

```text
MOVE
COPY
RENAME
MOVE_RENAME
DELETE
```

Semua operation saat ini masih berupa planning.

Tidak ada Drive mutation.

## File Target Semantics

Untuk file:

```text
Target = destination parent path
```

Contoh:

```text
Source:
A\B\file.ext

Target:
X\Y\Z
```

Preview result:

```text
X\Y\Z\file.ext
```

## Folder Target Semantics

Untuk folder:

```text
Target = final folder path
```

Contoh:

```text
Source:
A\B\OldFolder

Target:
X\Y\NewFolder
```

Engine menurunkan:

```text
Target parent = X\Y
Target name   = NewFolder
```

Jika nama source dan target berbeda, internal preview dapat menghasilkan:

```text
MOVE + RENAME
COPY + RENAME
```

---

# Pipeline Output

Multi-Phase dapat menghasilkan summary final per row:

* PipelineStatus
* FinalSource
* FinalSourceObjectID
* FinalSourceType
* FinalSourcePath
* FinalPhase
* PipelineNote

`FinalSource` menunjukkan asal source object:

```text
VERIFY
atau
RESOLVE
```

Pipeline output berguna untuk:

* filtering hasil akhir
* audit workflow
* monitoring batch
* memisahkan hasil Verify dan Resolve
* dan menyiapkan candidate row untuk real execution di versi berikutnya

---

# HTML Control Panel

VERRACT menyediakan panel kontrol berbasis HTML untuk mengelola workflow secara terpusat.

## Current Capabilities

* Persistent selection workflow
* Verify workflow configuration
* Resolve workflow configuration
* Action Preview configuration
* Multi-Phase workflow configuration
* Shared output mapping
* Pipeline output mapping
* Batch execution controls
* Engine status monitoring
* Diagnostics and state management
* Stop & Reset
* Column Mapping Remap
* Remap preview
* One-level remap undo

## Shared Output

Verify dan Resolve dapat menulis hasil ke shared output layer.

Available shared outputs:

* PathID
* FileID
* Path
* ObjectName
* Source

`ObjectName` digunakan untuk nama object terakhir, baik file maupun folder.

Shared output mapping disinkronkan antara workflow Verify, Resolve, Action, dan Multi-Phase.

## Selection Workflow

Control panel menggunakan model persistent selection.

Workflow:

1. Pilih range pada Google Sheets
2. Klik **Set Selection**
3. Konfigurasi workflow
4. Jalankan Verify, Resolve, Action Preview, atau Multi-Phase

Selection akan tetap aktif sampai diganti atau dibersihkan secara manual.

## Navigation

Control panel menyediakan:

* Home
* Verify
* Resolve
* Action Preview
* Multi-Phase Preview

Setiap workflow dapat dibuka sebagai view tersendiri.

---

# Column Mapping Remap

Jika struktur kolom Google Sheets berubah, user dapat melakukan remap setting tanpa mengatur ulang seluruh field secara manual.

Contoh:

```text
Moved Column From: AD
Moved Column To:   I
```

VERRACT akan menghitung perubahan posisi kolom lain dan memperbarui setting UI terkait.

Remap mendukung:

```text
D
D-F
D,E,G
D-G
```

Fitur ini hanya memperbarui setting VERRACT.

Fitur ini tidak memindahkan kolom di Google Sheets.

---

# Current Architecture

VERRACT saat ini bekerja pada level:

* file and folder verification
* path traversal
* filesystem resolution
* root-scoped lookup
* identity locking
* action planning
* multi-phase orchestration
* batch state management

Belum masuk ke:

* real filesystem mutation
* rollback system
* execution audit log
* sync monitoring
* full conflict recovery
* execution recovery subsystem

---

# Design Principles

VERRACT dirancang untuk:

* lightweight
* scalable
* spreadsheet-driven
* multi-account aware
* migration-safe
* audit-friendly
* resumable
* ID-first
* dry-run before mutation

tanpa ketergantungan terhadap:

* external server
* enterprise infrastructure
* proprietary DAM platform

---

# Technology Stack

* Google Apps Script (GAS)
* Google Sheets
* DriveApp
* ScriptProperties
* ScriptCache
* LockService
* Time-based Trigger
* HTML Service

---

# Known Limitation

Beberapa setting kolom yang diubah secara manual di sidebar masih dapat kembali ke nilai sebelumnya setelah sidebar reload atau setelah update melalui `clasp push`.

Masalah persistence ini tidak mengubah hasil dry-run yang sudah diproses, tetapi harus diperbaiki sebelum real Drive execution diaktifkan.

---

# Long-Term Direction

VERRACT tidak dirancang untuk menjadi aplikasi tunggal.

VERRACT dirancang untuk menjadi:

```text
filesystem engine layer
```

yang dapat digunakan oleh berbagai sistem manajemen aset dan workflow migrasi digital.

Roadmap jangka panjang tetap mengikuti filosofi:

```text
VERIFY → RESOLVE → ID → ACTION
```

dengan fokus menuju:

* identity-driven filesystem management
* migration-safe asset orchestration
* large-scale filesystem auditing
* structured asset lifecycle management
* controlled Google Drive execution
* recovery-aware migration workflow

---

# Next Direction

Target berikutnya:

```text
v0.6.0
Execution Engine Foundation
```

Scope awal:

* UI settings persistence hardening
* explicit execution confirmation
* pre-mutation validation
* row-level execution status
* audit logging
* idempotency
* double-run protection
* partial-failure handling
* actual MOVE, COPY, RENAME, and DELETE execution

Real operation tidak akan diaktifkan hanya dengan mengubah satu flag.

Karena filesystem bukan tempat yang sehat untuk optimisme buta.

---

# Notes

Project ini masih aktif berkembang.

Beberapa bagian kemungkinan akan berubah seiring evolusi:

* filesystem architecture
* taxonomy strategy
* migration pipeline
* orchestration model
* execution safety
* monitoring layer
* control panel workflow

Karena ternyata mengelola puluhan ribu aset digital lintas struktur dan akun bukan proses yang sederhana.

Mengejutkan sekali.

---

# Status

🚧 Active Development
