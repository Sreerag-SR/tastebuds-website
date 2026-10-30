require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "dev-only-change-this-secret";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads");
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(path.join(ROOT, "public")));

const db = new Database(path.join(DATA_DIR, "recipes.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    ingredients TEXT NOT NULL,
    steps TEXT NOT NULL,
    cooking_time INTEGER NOT NULL DEFAULT 30,
    difficulty TEXT NOT NULL DEFAULT 'Easy',
    image_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL REFERENCES users(id),
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, recipe_id)
  );
  CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL REFERENCES users(id),
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, recipe_id)
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const count = db.prepare("SELECT COUNT(*) AS n FROM recipes").get().n;
if (!count) {
  const seedUser = db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)")
    .run("Tastebuds Kitchen", "hello@tastebuds.local", bcrypt.hashSync("RecipeDemo123!", 10), "user");
  const seed = db.prepare(`INSERT INTO recipes
    (user_id,title,description,category,ingredients,steps,cooking_time,difficulty,image_url)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  [
    ["Creamy Tomato Pasta", "A comforting bowl of pasta with a silky tomato cream sauce.", "Dinner",
     "Pasta, 250 g\\nTomatoes, 3\\nGarlic, 3 cloves\\nCream, 1/2 cup\\nOlive oil, salt and pepper",
     "Boil pasta until al dente.\\nSauté garlic and chopped tomatoes in olive oil.\\nStir in cream and season.\\nToss pasta through the sauce and serve.", 25, "Easy",
     "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=85"],
    ["Avocado Breakfast Toast", "Fresh, bright avocado toast with lemon and chilli flakes.", "Breakfast",
     "Bread, 2 slices\\nRipe avocado, 1\\nLemon juice, 1 tsp\\nChilli flakes, to taste\\nSalt, to taste",
     "Toast the bread until golden.\\nMash avocado with lemon and salt.\\nSpread on toast and finish with chilli flakes.", 10, "Easy",
     "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=1200&q=85"],
    ["Rainbow Buddha Bowl", "A colorful, nourishing bowl packed with vegetables and grains.", "Healthy",
     "Cooked quinoa, 1 cup\\nChickpeas, 1 cup\\nCucumber, 1/2\\nCarrot, 1\\nLemon-tahini dressing",
     "Prepare quinoa according to its instructions.\\nChop the vegetables.\\nArrange quinoa, chickpeas and vegetables in a bowl.\\nDrizzle with dressing.", 20, "Easy",
     "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=85"],
    ["Berry Pancake Stack", "Fluffy weekend pancakes topped with berries and maple syrup.", "Dessert",
     "Flour, 1 cup\\nMilk, 3/4 cup\\nEgg, 1\\nBaking powder, 1 tsp\\nMixed berries and maple syrup",
     "Whisk flour and baking powder together.\\nAdd milk and egg, then mix until just combined.\\nCook small ladles of batter in a lightly greased pan.\\nServe with berries and syrup.", 20, "Medium",
     "https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=1200&q=85"]
  ].forEach(r => seed.run(seedUser.lastInsertRowid, ...r));
}
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
if (adminEmail && adminPassword && !db.prepare("SELECT id FROM users WHERE email=?").get(adminEmail.toLowerCase())) {
  db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)")
    .run("Administrator", adminEmail.toLowerCase(), bcrypt.hashSync(adminPassword, 10), "admin");
}

function tokenFor(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: "7d" });
}
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Please sign in to continue." });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch { return res.status(401).json({ error: "Your session expired. Please sign in again." }); }
}
function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Administrator access required." });
  next();
}
function publicUser(id) {
  return db.prepare("SELECT id,name,email,role,created_at FROM users WHERE id=?").get(id);
}
function recipeView(recipe, viewerId = 0) {
  const likes = db.prepare("SELECT COUNT(*) AS n FROM likes WHERE recipe_id=?").get(recipe.id).n;
  const comments = db.prepare(`SELECT c.id,c.body,c.created_at,u.name AS author
    FROM comments c JOIN users u ON u.id=c.user_id WHERE c.recipe_id=? ORDER BY c.id DESC`).all(recipe.id);
  const favorite = viewerId ? !!db.prepare("SELECT 1 FROM favorites WHERE user_id=? AND recipe_id=?").get(viewerId, recipe.id) : false;
  const liked = viewerId ? !!db.prepare("SELECT 1 FROM likes WHERE user_id=? AND recipe_id=?").get(viewerId, recipe.id) : false;
  return { ...recipe, ingredients: recipe.ingredients.split("\n"), steps: recipe.steps.split("\n"),
    author: db.prepare("SELECT name FROM users WHERE id=?").get(recipe.user_id)?.name || "Home cook",
    likes, comments, favorite, liked };
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) =>
      cb(null, Date.now() + "-" + file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_"))
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) =>
    cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype))
});

// Image upload API
app.post("/api/upload", auth, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Please select a valid image." });
  }

  res.status(201).json({
    image_url: `/uploads/${req.file.filename}`
  });
});


app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password || password.length < 8)
    return res.status(400).json({ error: "Name, email and a password of at least 8 characters are required." });
  try {
    const result = db.prepare("INSERT INTO users(name,email,password_hash) VALUES(?,?,?)")
      .run(name.trim(), email.trim().toLowerCase(), bcrypt.hashSync(password, 10));
    const user = publicUser(result.lastInsertRowid);
    res.status(201).json({ token: tokenFor(user), user });
  } catch (e) {
    res.status(409).json({ error: "An account with that email already exists." });
  }
});
app.post("/api/auth/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!user || !bcrypt.compareSync(String(req.body?.password || ""), user.password_hash))
    return res.status(401).json({ error: "Email or password is incorrect." });
  res.json({ token: tokenFor(user), user: publicUser(user.id) });
});
app.get("/api/auth/me", auth, (req, res) => {
  const user = publicUser(req.user.id);
  if (!user) return res.status(401).json({ error: "Account not found." });
  res.json({ user });
});

app.get("/api/recipes", (req, res) => {
  const { q = "", category = "", difficulty = "", sort = "newest", favorite = "" } = req.query;
  const viewerId = Number(req.query.viewerId || 0);
  let sql = `SELECT r.* FROM recipes r JOIN users u ON u.id=r.user_id WHERE
    (r.title LIKE @q OR r.description LIKE @q OR r.ingredients LIKE @q)`;
  const params = { q: `%${String(q).slice(0,100)}%` };
  if (category) { sql += " AND r.category=@category"; params.category = category; }
  if (difficulty) { sql += " AND r.difficulty=@difficulty"; params.difficulty = difficulty; }
  if (favorite === "true" && viewerId) {
    sql += " AND EXISTS (SELECT 1 FROM favorites f WHERE f.recipe_id=r.id AND f.user_id=@viewerId)";
    params.viewerId = viewerId;
  }
  sql += sort === "popular"
    ? " ORDER BY (SELECT COUNT(*) FROM likes l WHERE l.recipe_id=r.id) DESC, r.id DESC"
    : " ORDER BY r.id DESC";
  res.json(db.prepare(sql).all(params).map(r => recipeView(r, viewerId)));
});
app.get("/api/recipes/:id", (req, res) => {
  const r = db.prepare("SELECT * FROM recipes WHERE id=?").get(req.params.id);
  if (!r) return res.status(404).json({ error: "Recipe not found." });
  res.json(recipeView(r, Number(req.query.viewerId || 0)));
});
app.post("/api/recipes", auth, (req, res) => {
  const { title, description, category, ingredients, steps, cooking_time, difficulty, image_url } = req.body || {};
  if (![title, description, category, ingredients, steps].every(v => String(v || "").trim()))
    return res.status(400).json({ error: "Please complete all required recipe fields." });
  const result = db.prepare(`INSERT INTO recipes(user_id,title,description,category,ingredients,steps,cooking_time,difficulty,image_url)
    VALUES(?,?,?,?,?,?,?,?,?)`).run(req.user.id, title.trim(), description.trim(), category, ingredients, steps,
      Math.max(1, Math.min(1440, Number(cooking_time) || 30)), difficulty || "Easy", image_url || "");
  res.status(201).json(recipeView(db.prepare("SELECT * FROM recipes WHERE id=?").get(result.lastInsertRowid), req.user.id));
});
app.put("/api/recipes/:id", auth, (req, res) => {
  const old = db.prepare("SELECT * FROM recipes WHERE id=?").get(req.params.id);
  if (!old) return res.status(404).json({ error: "Recipe not found." });
  if (old.user_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "You can only edit your own recipes." });
  const b = req.body || {};
  const fields = {
    title: b.title ?? old.title, description: b.description ?? old.description, category: b.category ?? old.category,
    ingredients: Array.isArray(b.ingredients) ? b.ingredients.join("\n") : (b.ingredients ?? old.ingredients),
    steps: Array.isArray(b.steps) ? b.steps.join("\n") : (b.steps ?? old.steps),
    cooking_time: Number(b.cooking_time ?? old.cooking_time), difficulty: b.difficulty ?? old.difficulty,
    image_url: b.image_url ?? old.image_url
  };
  db.prepare(`UPDATE recipes SET title=?,description=?,category=?,ingredients=?,steps=?,cooking_time=?,difficulty=?,image_url=? WHERE id=?`)
    .run(fields.title, fields.description, fields.category, fields.ingredients, fields.steps, fields.cooking_time, fields.difficulty, fields.image_url, old.id);
  res.json(recipeView(db.prepare("SELECT * FROM recipes WHERE id=?").get(old.id), req.user.id));
});
app.delete("/api/recipes/:id", auth, (req, res) => {
  const old = db.prepare("SELECT * FROM recipes WHERE id=?").get(req.params.id);
  if (!old) return res.status(404).json({ error: "Recipe not found." });
  if (old.user_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "You can only delete your own recipes." });
  db.prepare("DELETE FROM recipes WHERE id=?").run(old.id);
  res.json({ message: "Recipe deleted." });
});
app.post("/api/recipes/:id/favorite", auth, (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT id FROM recipes WHERE id=?").get(id)) return res.status(404).json({ error: "Recipe not found." });
  const exists = db.prepare("SELECT 1 FROM favorites WHERE user_id=? AND recipe_id=?").get(req.user.id, id);
  exists ? db.prepare("DELETE FROM favorites WHERE user_id=? AND recipe_id=?").run(req.user.id, id)
    : db.prepare("INSERT INTO favorites(user_id,recipe_id) VALUES(?,?)").run(req.user.id, id);
  res.json({ favorite: !exists });
});
app.post("/api/recipes/:id/like", auth, (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT id FROM recipes WHERE id=?").get(id)) return res.status(404).json({ error: "Recipe not found." });
  const exists = db.prepare("SELECT 1 FROM likes WHERE user_id=? AND recipe_id=?").get(req.user.id, id);
  exists ? db.prepare("DELETE FROM likes WHERE user_id=? AND recipe_id=?").run(req.user.id, id)
    : db.prepare("INSERT INTO likes(user_id,recipe_id) VALUES(?,?)").run(req.user.id, id);
  res.json({ liked: !exists });
});
app.post("/api/recipes/:id/comments", auth, (req, res) => {
  const body = String(req.body?.body || "").trim();
  if (!body || body.length > 500) return res.status(400).json({ error: "Comment must be between 1 and 500 characters." });
  if (!db.prepare("SELECT id FROM recipes WHERE id=?").get(req.params.id)) return res.status(404).json({ error: "Recipe not found." });
  db.prepare("INSERT INTO comments(user_id,recipe_id,body) VALUES(?,?,?)").run(req.user.id, req.params.id, body);
  res.status(201).json({ message: "Comment added." });
});
app.delete("/api/comments/:id", auth, (req, res) => {
  const c = db.prepare("SELECT * FROM comments WHERE id=?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "Comment not found." });
  if (c.user_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Not allowed." });
  db.prepare("DELETE FROM comments WHERE id=?").run(c.id);
  res.json({ message: "Comment deleted." });
});
app.get("/api/admin/stats", auth, adminOnly, (_, res) => {
  res.json({
    users: db.prepare("SELECT COUNT(*) n FROM users").get().n,
    recipes: db.prepare("SELECT COUNT(*) n FROM recipes").get().n,
    comments: db.prepare("SELECT COUNT(*) n FROM comments").get().n,
    recentUsers: db.prepare("SELECT id,name,email,role,created_at FROM users ORDER BY id DESC LIMIT 10").all()
  });
});
app.get("/api/admin/recipes", auth, adminOnly, (_, res) => {
  res.json(db.prepare("SELECT r.*,u.name AS author FROM recipes r JOIN users u ON u.id=r.user_id ORDER BY r.id DESC").all());
});
app.delete("/api/admin/users/:id", auth, adminOnly, (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: "You cannot delete your own admin account." });
  const user = db.prepare("SELECT id FROM users WHERE id=?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  db.prepare("DELETE FROM comments WHERE user_id=?").run(user.id);
  db.prepare("DELETE FROM favorites WHERE user_id=?").run(user.id);
  db.prepare("DELETE FROM likes WHERE user_id=?").run(user.id);
  db.prepare("DELETE FROM recipes WHERE user_id=?").run(user.id);
  db.prepare("DELETE FROM users WHERE id=?").run(user.id);
  res.json({ message: "User and associated content deleted." });
});

app.get("*", (req, res) => res.sendFile(path.join(ROOT, "public", "index.html")));
app.listen(PORT, () => console.log(`Tastebuds is running at http://localhost:${PORT}`));
