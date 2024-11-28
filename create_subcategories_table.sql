CREATE TABLE subcategories (.
    id SERIAL PRIMAY KEY,
    name TEXT NOT NULL,
    parent_id INTEGER NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES categories (id)
);