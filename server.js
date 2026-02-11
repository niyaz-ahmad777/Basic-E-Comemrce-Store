const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcrypt");
const db = require("./db");

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.use(
  session({
    store: new SQLiteStore({ db: "sessions.db" }),
    secret: "super_secret_key_change_it",
    resave: false,
    saveUninitialized: false,
  })
);

// Helpers
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.cartCount = req.session.cart
    ? Object.values(req.session.cart).reduce((a, i) => a + i.qty, 0)
    : 0;
  next();
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// Home - products
app.get("/", (req, res) => {
  db.all("SELECT * FROM products ORDER BY created_at DESC", (err, products) => {
    console.log("Products count:", products?.length);
    if (err) return res.status(500).send("DB Error");
    res.render("home", { products });
  });
});

// Product details
app.get("/product/:id", (req, res) => {
  db.get("SELECT * FROM products WHERE id = ?", [req.params.id], (err, product) => {
    if (err) return res.status(500).send("DB Error");
    if (!product) return res.status(404).send("Product not found");
    res.render("product", { product });
  });
});

// Cart
app.get("/cart", (req, res) => {
  const cart = req.session.cart || {};
  const items = Object.values(cart);
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  res.render("cart", { items, total });
});

app.post("/cart/add", (req, res) => {
  const { id, qty } = req.body;
  const quantity = Math.max(1, parseInt(qty || "1", 10));

  db.get("SELECT * FROM products WHERE id = ?", [id], (err, product) => {
    if (err) return res.status(500).json({ ok: false });
    if (!product) return res.status(404).json({ ok: false });

    if (!req.session.cart) req.session.cart = {};
    const cart = req.session.cart;

    if (cart[id]) cart[id].qty += quantity;
    else cart[id] = { id: product.id, title: product.title, price: product.price, image_url: product.image_url, qty: quantity };

    res.json({ ok: true, cartCount: Object.values(cart).reduce((a, i) => a + i.qty, 0) });
  });
});

app.post("/cart/update", (req, res) => {
  const { id, qty } = req.body;
  const cart = req.session.cart || {};
  if (!cart[id]) return res.json({ ok: true });

  const quantity = parseInt(qty, 10);
  if (quantity <= 0) delete cart[id];
  else cart[id].qty = quantity;

  req.session.cart = cart;
  res.json({ ok: true });
});

app.post("/cart/clear", (req, res) => {
  req.session.cart = {};
  res.redirect("/cart");
});

// Checkout
app.get("/checkout", requireAuth, (req, res) => {
  const cart = req.session.cart || {};
  const items = Object.values(cart);
  if (items.length === 0) return res.redirect("/cart");
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  res.render("checkout", { items, total });
});

app.post("/checkout", requireAuth, (req, res) => {
  const { address, phone } = req.body;
  const cart = req.session.cart || {};
  const items = Object.values(cart);
  if (items.length === 0) return res.redirect("/cart");

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  db.run(
    "INSERT INTO orders (user_id, total, address, phone) VALUES (?, ?, ?, ?)",
    [req.session.user.id, total, address.trim(), phone.trim()],
    function (err) {
      if (err) return res.status(500).send("Order failed");

      const orderId = this.lastID;
      const stmt = db.prepare(
        "INSERT INTO order_items (order_id, product_id, title, price, qty) VALUES (?, ?, ?, ?, ?)"
      );

      items.forEach((it) => {
        stmt.run(orderId, it.id, it.title, it.price, it.qty);
      });

      stmt.finalize(() => {
        req.session.cart = {};
        res.redirect("/orders");
      });
    }
  );
});

// Orders
app.get("/orders", requireAuth, (req, res) => {
  db.all(
    "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
    [req.session.user.id],
    (err, orders) => {
      if (err) return res.status(500).send("DB Error");

      const ids = orders.map(o => o.id);
      if (ids.length === 0) return res.render("orders", { orders: [], itemsByOrder: {} });

      db.all(
        `SELECT * FROM order_items WHERE order_id IN (${ids.map(() => "?").join(",")})`,
        ids,
        (err2, items) => {
          if (err2) return res.status(500).send("DB Error");
          const itemsByOrder = {};
          items.forEach(it => {
            itemsByOrder[it.order_id] = itemsByOrder[it.order_id] || [];
            itemsByOrder[it.order_id].push(it);
          });
          res.render("orders", { orders, itemsByOrder });
        }
      );
    }
  );
});

// Auth
app.get("/register", (req, res) => res.render("register", { error: null }));
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.render("register", { error: "All fields are required." });

  const hash = await bcrypt.hash(password, 10);

  db.run(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
    [name.trim(), email.trim().toLowerCase(), hash],
    function (err) {
      if (err) return res.render("register", { error: "Email already registered." });
      req.session.user = { id: this.lastID, name: name.trim(), email: email.trim().toLowerCase() };
      res.redirect("/");
    }
  );
});

app.get("/login", (req, res) => res.render("login", { error: null }));
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()], async (err, user) => {
    if (err) return res.render("login", { error: "Something went wrong." });
    if (!user) return res.render("login", { error: "Invalid email or password." });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.render("login", { error: "Invalid email or password." });

    req.session.user = { id: user.id, name: user.name, email: user.email };
    res.redirect("/");
  });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.listen(PORT, () => console.log(`✅ Server running: http://localhost:${PORT}`));
