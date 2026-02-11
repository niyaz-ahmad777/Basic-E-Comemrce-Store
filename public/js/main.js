function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.style.position = "fixed";
    el.style.right = "18px";
    el.style.bottom = "18px";
    el.style.padding = "12px 14px";
    el.style.borderRadius = "14px";
    el.style.background = "rgba(17,31,58,.92)";
    el.style.border = "1px solid rgba(255,255,255,.10)";
    el.style.color = "#e8eefc";
    el.style.boxShadow = "0 18px 40px rgba(0,0,0,.35)";
    el.style.backdropFilter = "blur(10px)";
    el.style.transform = "translateY(10px)";
    el.style.opacity = "0";
    el.style.transition = "all .25s ease";
    el.style.zIndex = "9999";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(10px)";
  }, 1400);
}

async function addToCart(id, qty) {
  const res = await fetch("/cart/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, qty })
  });
  const data = await res.json();
  if (data.ok) {
    toast("Added to cart ✅");
    setTimeout(() => location.reload(), 250);
  } else {
    toast("Failed to add ❌");
  }
}

async function updateCart(id, qty) {
  await fetch("/cart/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, qty })
  });
  location.reload();
}

const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting) e.target.classList.add("show");
  });
},{threshold:0.12});

window.addEventListener("load", ()=>{
  document.querySelectorAll(".reveal").forEach(el=>io.observe(el));
});
