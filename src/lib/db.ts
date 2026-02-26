export interface TodoRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  project: string | null;
  parent_id: string | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function now(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
