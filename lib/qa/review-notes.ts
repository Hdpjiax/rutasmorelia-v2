import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

/** `note` = solo borrador guardado; `needs_review` = enviada explícitamente a revisión */
export type ReviewNoteStatus = 'note' | 'needs_review';

export interface ReviewFlag {
  id: string;
  coords: [number, number];
  note: string;
  created_at: string;
  severity: 'critical' | 'review' | 'note';
}

export interface ReviewNote {
  route_id: string;
  route_name: string;
  note: string;
  status: ReviewNoteStatus;
  created_at: string;
  updated_at: string;
  created_by?: string;
  flags?: ReviewFlag[];
}

export interface ReviewNotesFile {
  notes: ReviewNote[];
}

const NOTES_PATH = path.join(process.cwd(), 'data', 'qa-reports', 'review-notes.json');

export async function loadReviewNotes(): Promise<ReviewNote[]> {
  try {
    const raw = await readFile(NOTES_PATH, 'utf-8');
    const data = JSON.parse(raw) as ReviewNotesFile;
    return data.notes ?? [];
  } catch {
    return [];
  }
}

export async function saveReviewNoteOnly(
  input: Pick<ReviewNote, 'route_id' | 'route_name' | 'note' | 'flags'> & { created_by?: string }
): Promise<ReviewNote> {
  return persistReviewNote(input, 'note');
}

export async function saveReviewNoteSentToReview(
  input: Pick<ReviewNote, 'route_id' | 'route_name' | 'note' | 'flags'> & { created_by?: string }
): Promise<ReviewNote> {
  return persistReviewNote(input, 'needs_review');
}

async function persistReviewNote(
  input: Pick<ReviewNote, 'route_id' | 'route_name' | 'note' | 'flags'> & { created_by?: string },
  status: ReviewNoteStatus
): Promise<ReviewNote> {
  await mkdir(path.dirname(NOTES_PATH), { recursive: true });
  const notes = await loadReviewNotes();
  const now = new Date().toISOString();
  const existing = notes.findIndex((n) => n.route_id === input.route_id);
  const entry: ReviewNote = {
    route_id: input.route_id,
    route_name: input.route_name,
    note: input.note.trim(),
    status,
    created_at: existing >= 0 ? notes[existing].created_at : now,
    updated_at: now,
    created_by: input.created_by,
    flags: input.flags || (existing >= 0 ? notes[existing].flags : []),
  };
  if (existing >= 0) {
    notes[existing] = entry;
  } else {
    notes.push(entry);
  }
  await writeFile(
    NOTES_PATH,
    JSON.stringify({ notes } satisfies ReviewNotesFile, null, 2),
    'utf-8'
  );
  return entry;
}

/** @deprecated Usar saveReviewNoteOnly o saveReviewNoteSentToReview */
export async function saveReviewNote(
  input: Pick<ReviewNote, 'route_id' | 'route_name' | 'note'> & { created_by?: string }
): Promise<ReviewNote> {
  return saveReviewNoteOnly(input);
}

export async function deleteReviewNote(routeId: string): Promise<boolean> {
  const notes = await loadReviewNotes();
  const next = notes.filter((n) => n.route_id !== routeId);
  if (next.length === notes.length) return false;
  await writeFile(
    NOTES_PATH,
    JSON.stringify({ notes: next } satisfies ReviewNotesFile, null, 2),
    'utf-8'
  );
  return true;
}