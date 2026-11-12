-- A student's own choice of what shows at the bottom of their Home page (Profile → Home page). 1 = shown (the default).
ALTER TABLE users ADD COLUMN show_class_averages INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN show_progress INTEGER NOT NULL DEFAULT 1;
