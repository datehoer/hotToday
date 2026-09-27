-- Source snapshots use the same shape as the existing HotToday source tables.
CREATE TABLE IF NOT EXISTS dezeen (
    id SERIAL PRIMARY KEY,
    data JSONB,
    insert_time BIGINT
);

CREATE TABLE IF NOT EXISTS gcores (
    id SERIAL PRIMARY KEY,
    data JSONB,
    insert_time BIGINT
);

CREATE TABLE IF NOT EXISTS designboom (
    id SERIAL PRIMARY KEY,
    data JSONB,
    insert_time BIGINT
);
