ALTER TABLE projects ADD COLUMN directory_path TEXT CHECK(length(directory_path) <= 500);
