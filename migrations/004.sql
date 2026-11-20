CREATE TABLE IF NOT EXISTS case_forums (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL,
    phase VARCHAR(10) NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    UNIQUE(case_id,phase),
    FOREIGN KEY(case_id) REFERENCES cases(id),
    CHECK(phase IN ('before','after'))
);
CREATE TABLE IF NOT EXISTS forum_posts (
    id VARCHAR(64) PRIMARY KEY,
    forum_id VARCHAR(64) NOT NULL,
    app_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    version_id VARCHAR(64) NOT NULL,
    parent_id VARCHAR(64),
    client_key VARCHAR(100) NOT NULL,
    body LONGTEXT NOT NULL,
    rich_text LONGTEXT NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    UNIQUE(id,forum_id),
    UNIQUE(app_id,forum_id,client_key),
    UNIQUE(forum_id,created_at,id),
    FOREIGN KEY(forum_id) REFERENCES case_forums(id),
    FOREIGN KEY(app_id) REFERENCES applications(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(version_id) REFERENCES case_versions(id),
    FOREIGN KEY(parent_id,forum_id) REFERENCES forum_posts(id,forum_id)
);
