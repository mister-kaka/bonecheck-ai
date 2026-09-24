import { mkdirSync } from 'fs';
import path from 'path';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { MlPrediction } from '../ml/ml.types';
import { resolveDatabasePath } from './database-path';
import { StudyRecord, StudyRepository, StudyStatus } from './study.types';

type StudyRow = {
  id: string;
  session_id: string | null;
  status: string;
  original_file_name: string;
  stored_file_path: string;
  created_at: string;
  updated_at: string;
  error: string | null;
  quality_class: number | null;
  quality_prob: number | null;
  violation_type: string | null;
  anatomical_region: string | null;
};

type StudyParams = {
  id: string;
  session_id: string | null;
  status: StudyStatus;
  original_file_name: string;
  stored_file_path: string;
  created_at: string;
  updated_at: string;
  error: string | null;
  quality_class: number | null;
  quality_prob: number | null;
  violation_type: string | null;
  anatomical_region: string | null;
};

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS studies (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('uploaded', 'processing', 'completed', 'error')),
  original_file_name TEXT NOT NULL,
  stored_file_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  error TEXT,
  quality_class INTEGER CHECK (quality_class IS NULL OR quality_class IN (0, 1)),
  quality_prob REAL,
  violation_type TEXT,
  anatomical_region TEXT
);

CREATE INDEX IF NOT EXISTS idx_studies_session_id ON studies (session_id);
CREATE INDEX IF NOT EXISTS idx_studies_created_at ON studies (created_at);
`;

@Injectable()
export class SqliteStudyRepository implements StudyRepository, OnModuleDestroy {
  private readonly logger = new Logger(SqliteStudyRepository.name);
  private readonly db: Database.Database;
  private readonly upsert: Database.Statement<StudyParams>;
  private readonly selectById: Database.Statement<[string], StudyRow>;
  private readonly selectAll: Database.Statement<[], StudyRow>;
  private readonly selectBySession: Database.Statement<[string], StudyRow>;

  constructor() {
    const filePath = resolveDatabasePath();
    mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(SCHEMA_SQL);

    this.upsert = this.db.prepare<StudyParams>(`
      INSERT INTO studies (
        id,
        session_id,
        status,
        original_file_name,
        stored_file_path,
        created_at,
        updated_at,
        error,
        quality_class,
        quality_prob,
        violation_type,
        anatomical_region
      ) VALUES (
        @id,
        @session_id,
        @status,
        @original_file_name,
        @stored_file_path,
        @created_at,
        @updated_at,
        @error,
        @quality_class,
        @quality_prob,
        @violation_type,
        @anatomical_region
      )
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        updated_at = excluded.updated_at,
        error = excluded.error,
        quality_class = excluded.quality_class,
        quality_prob = excluded.quality_prob,
        violation_type = excluded.violation_type,
        anatomical_region = excluded.anatomical_region
    `);
    this.selectById = this.db.prepare<[string], StudyRow>(
      'SELECT * FROM studies WHERE id = ?',
    );
    this.selectAll = this.db.prepare<[], StudyRow>(
      'SELECT * FROM studies ORDER BY created_at DESC, id DESC',
    );
    this.selectBySession = this.db.prepare<[string], StudyRow>(
      'SELECT * FROM studies WHERE session_id = ? ORDER BY created_at DESC, id DESC',
    );

    this.logger.log(`SQLite opened at ${filePath}`);
  }

  onModuleDestroy(): void {
    if (this.db.open) {
      this.db.close();
    }
  }

  async save(study: StudyRecord): Promise<StudyRecord> {
    this.upsert.run(this.toParams(study));
    const saved = await this.findById(study.id);
    if (!saved) {
      throw new Error(`Study ${study.id} was not persisted.`);
    }
    return saved;
  }

  async findById(id: string): Promise<StudyRecord | null> {
    const row = this.selectById.get(id);
    return row ? this.toRecord(row) : null;
  }

  async findAll(sessionId?: string): Promise<StudyRecord[]> {
    const rows =
      sessionId === undefined ? this.selectAll.all() : this.selectBySession.all(sessionId);
    return rows.map((row) => this.toRecord(row));
  }

  private toParams(study: StudyRecord): StudyParams {
    return {
      id: study.id,
      session_id: study.sessionId,
      status: study.status,
      original_file_name: study.originalFileName,
      stored_file_path: study.storedFilePath,
      created_at: study.createdAt,
      updated_at: study.updatedAt,
      error: study.error,
      quality_class: study.result ? study.result.quality_class : null,
      quality_prob:
        study.result && study.result.quality_prob !== undefined ? study.result.quality_prob : null,
      violation_type: study.result ? study.result.violation_type : null,
      anatomical_region: study.result?.anatomical_region ?? null,
    };
  }

  private toRecord(row: StudyRow): StudyRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      status: row.status as StudyStatus,
      originalFileName: row.original_file_name,
      storedFilePath: row.stored_file_path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      error: row.error,
      result: this.toResult(row),
    };
  }

  private toResult(row: StudyRow): MlPrediction | null {
    if (row.quality_class !== 0 && row.quality_class !== 1) {
      return null;
    }

    const result: MlPrediction = {
      quality_class: row.quality_class,
      violation_type: row.violation_type ?? '',
    };

    if (row.quality_prob !== null) {
      result.quality_prob = row.quality_prob;
    }

    if (row.anatomical_region) {
      result.anatomical_region = row.anatomical_region;
    }

    return result;
  }
}
