const db = require("./db");

const products = [
  {
    title: "Wireless Headphones",
    price: 1499,
    description: "Comfortable, high-bass wireless headphones with long battery life.",
    image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
    stock: 25
  },
  {
    title: "Smart Watch",
    price: 2499,
    description: "Fitness tracking smart watch with notifications and heart-rate monitor.",
    image_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900",
    stock: 15
  },
  {
    title: "Laptop Backpack",
    price: 999,
    description: "Water-resistant backpack with padded laptop compartment.",
    image_url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900",
    stock: 30
  },
  {
    title: "Bluetooth Speaker",
    price: 1799,
    description: "Portable speaker with deep bass and 10-hour playtime.",
    image_url: "https://images.unsplash.com/photo-1589003077984-894e133dabab?w=900",
    stock: 20
  }
];

db.serialize(() => {
  db.run("DELETE FROM products", (err) => {
    if (err) console.error(err);

    const stmt = db.prepare(
      "INSERT INTO products (title, price, description, image_url, stock) VALUES (?, ?, ?, ?, ?)"
    );

    products.forEach(p => stmt.run(p.title, p.price, p.description, p.image_url, p.stock));

    stmt.finalize(() => {
      console.log("✅ Seed done: products inserted successfully.");
      process.exit(0);
    });
  });
});
