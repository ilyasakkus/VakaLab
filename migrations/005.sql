CREATE TABLE IF NOT EXISTS research_groups (
 id VARCHAR(64) PRIMARY KEY, owner_id VARCHAR(64) NOT NULL, name VARCHAR(200) NOT NULL, created_at VARCHAR(32) NOT NULL,
 UNIQUE(owner_id,name), FOREIGN KEY(owner_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS research_settings (
 id VARCHAR(64) PRIMARY KEY, case_id VARCHAR(64) NOT NULL, revision INT NOT NULL, week_id VARCHAR(64), group_id VARCHAR(64),
 protocol_version VARCHAR(100) NOT NULL, framework LONGTEXT NOT NULL, reason LONGTEXT NOT NULL, actor VARCHAR(64) NOT NULL, created_at VARCHAR(32) NOT NULL,
 UNIQUE(case_id,revision), FOREIGN KEY(case_id) REFERENCES cases(id), FOREIGN KEY(group_id) REFERENCES research_groups(id), FOREIGN KEY(actor) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS research_post_context (
 post_id VARCHAR(64) PRIMARY KEY, forum_id VARCHAR(64) NOT NULL, ordinal INT NOT NULL, settings_id VARCHAR(64), week_id VARCHAR(64), group_id VARCHAR(64),
 UNIQUE(forum_id,ordinal), FOREIGN KEY(post_id) REFERENCES forum_posts(id), FOREIGN KEY(forum_id) REFERENCES case_forums(id), FOREIGN KEY(settings_id) REFERENCES research_settings(id), FOREIGN KEY(group_id) REFERENCES research_groups(id)
);
CREATE TABLE IF NOT EXISTS research_dialogues (
 id VARCHAR(64) PRIMARY KEY, case_id VARCHAR(64) NOT NULL, phase VARCHAR(10) NOT NULL, label VARCHAR(200) NOT NULL, rationale LONGTEXT NOT NULL,
 actor VARCHAR(64) NOT NULL, created_at VARCHAR(32) NOT NULL, FOREIGN KEY(case_id) REFERENCES cases(id), FOREIGN KEY(actor) REFERENCES users(id), CHECK(phase IN ('before','after'))
);
CREATE TABLE IF NOT EXISTS research_dialogue_posts (
 dialogue_id VARCHAR(64) NOT NULL, post_id VARCHAR(64) NOT NULL, position INT NOT NULL,
 PRIMARY KEY(dialogue_id,post_id), UNIQUE(dialogue_id,position), FOREIGN KEY(dialogue_id) REFERENCES research_dialogues(id), FOREIGN KEY(post_id) REFERENCES forum_posts(id)
);
CREATE TABLE IF NOT EXISTS research_annotations (
 id VARCHAR(64) PRIMARY KEY, post_id VARCHAR(64), dialogue_id VARCHAR(64), evidence_dialogue_id VARCHAR(64),
 coder_label VARCHAR(100) NOT NULL, round_no INT NOT NULL, code VARCHAR(1) NOT NULL, status VARCHAR(20) NOT NULL, evidence LONGTEXT NOT NULL,
 interactive_reviewed INT NOT NULL DEFAULT 0, supersedes_id VARCHAR(64), actor VARCHAR(64) NOT NULL, created_at VARCHAR(32) NOT NULL,
 FOREIGN KEY(post_id) REFERENCES forum_posts(id), FOREIGN KEY(dialogue_id) REFERENCES research_dialogues(id), FOREIGN KEY(evidence_dialogue_id) REFERENCES research_dialogues(id),
 FOREIGN KEY(supersedes_id) REFERENCES research_annotations(id), FOREIGN KEY(actor) REFERENCES users(id),
 CHECK((post_id IS NOT NULL AND dialogue_id IS NULL) OR (post_id IS NULL AND dialogue_id IS NOT NULL)), CHECK(code IN ('P','A','C','I','U')), CHECK(status IN ('provisional','reviewed','consensus'))
);
