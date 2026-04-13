-- ステータスを5段階カンバンフローに移行: pending→backlog, completed→done
-- 新ステータス: backlog | todo | in_progress | review | done

UPDATE todos SET status = 'backlog' WHERE status = 'pending';
UPDATE todos SET status = 'done' WHERE status = 'completed';

-- completed_at → done_at にリネーム
ALTER TABLE todos RENAME COLUMN completed_at TO done_at;
