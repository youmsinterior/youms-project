// ----------------------------
// Boutique + Panier Professionnel
// ----------------------------

const produitsContainer = document.getElementById("produits-container");
const searchInput = document.getElementById("search-input");
const boutonsCategories = document.querySelectorAll("[data-categorie]");

// Offcanvas / Panier UI
const cartItemsEl = document.getElementById("cart-items");
const cartTotalEl = document.getElementById("cart-total");
const cartCountBadge = document.getElementById("cart-count-badge");
const btnClearCart = document.getElementById("btn-clear-cart");
const btnCheckout = document.getElementById("btn-checkout");

let tousLesProduits = [];
let produitsById = new Map(); // id -> produit
let categorieActive = "tous";

// Prix utilitaires
const formatPrice = (value) =>
  new Intl.NumberFormat("fr-FR").format(value) + " CFA";

const parsePrice = (str) => {
  // "15 000 CFA" -> 15000
  if (!str) return 0;
  return parseInt(str.replace(/\s+/g, "").replace(/[^\d]/g, ""), 10) || 0;
};

// ----------------------------
// Panier (localStorage)
// ----------------------------
const CART_KEY = "youms_interior_cart_v1";

class Cart {
  constructor() {
    this.items = []; // {id, qty}
    this.load();
  }
  load() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      this.items = raw ? JSON.parse(raw) : [];
    } catch {
      this.items = [];
    }
  }
  save() {
    localStorage.setItem(CART_KEY, JSON.stringify(this.items));
    renderCart();
  }
  count() {
    return this.items.reduce((sum, it) => sum + it.qty, 0);
  }
  total() {
    return this.items.reduce((sum, it) => {
      const p = produitsById.get(it.id);
      const price = p ? parsePrice(p.prix) : 0;
      return sum + price * it.qty;
    }, 0);
  }
  add(id, qty = 1) {
    const found = this.items.find((it) => it.id === id);
    if (found) found.qty += qty;
    else this.items.push({ id, qty });
    this.save();
    showToastAdd();
  }
  remove(id) {
    this.items = this.items.filter((it) => it.id !== id);
    this.save();
  }
  setQty(id, qty) {
    const n = Math.max(1, parseInt(qty, 10) || 1);
    const found = this.items.find((it) => it.id === id);
    if (found) {
      found.qty = n;
      this.save();
    }
  }
  dec(id) {
    const found = this.items.find((it) => it.id === id);
    if (!found) return;
    if (found.qty > 1) {
      found.qty -= 1;
      this.save();
    } else {
      // si qty 1 et on décrémente → suppression
      this.remove(id);
    }
  }
  inc(id) {
    const found = this.items.find((it) => it.id === id);
    if (!found) return;
    found.qty += 1;
    this.save();
  }
  clear() {
    this.items = [];
    this.save();
  }
}
const cart = new Cart();

// ----------------------------
// Chargement produits
// ----------------------------
fetch("/data/produits.json")
  .then((response) => response.json())
  .then((produits) => {
    tousLesProduits = produits;
    produitsById = new Map(produits.map((p) => [p.id, p]));
    afficherProduits(produits);
    renderCart(); // après chargement produits (pour total/prix)
  })
  .catch((error) => {
    produitsContainer.innerHTML =
      `<p class="text-center text-danger">Erreur lors du chargement des produits.</p>`;
    console.error("Erreur:", error);
  });

// ----------------------------
// Affichage produits
// ----------------------------
function afficherProduits(produits) {
  produitsContainer.innerHTML = "";

  if (!produits || produits.length === 0) {
    produitsContainer.innerHTML = `
      <div class="col-12 text-center">
        <p class="text-muted fs-5">Aucun article trouvé 😕</p>
      </div>`;
    return;
  }

  produits.forEach((produit) => {
    const card = document.createElement("div");
    card.className = "col-md-4";

    card.innerHTML = `
      <div class="card shadow-sm border-0 rounded-3 h-100">
        <img src="${produit.image}" class="card-img-top" alt="${produit.nom}" style="height:260px; object-fit:cover;">
        <div class="card-body text-center d-flex flex-column">
          <h5 class="card-title">${produit.nom}</h5>
          <p class="card-text text-muted">${produit.description}</p>
          <p class="fw-bold fs-5">${produit.prix}</p>
          <button class="btn btn-commander mt-auto" data-add-to-cart data-id="${produit.id}">
            Ajouter au panier
          </button>
        </div>
      </div>
    `;
    produitsContainer.appendChild(card);
  });
}

// ----------------------------
// Recherche + Catégories (si tu as des boutons [data-categorie])
// ----------------------------
if (searchInput) {
  searchInput.addEventListener("input", filtrerProduits);
}
boutonsCategories.forEach((bouton) => {
  bouton.classList.add("btn-categorie");
  bouton.addEventListener("click", () => {
    boutonsCategories.forEach((btn) => btn.classList.remove("active"));
    bouton.classList.add("active");
    categorieActive = bouton.dataset.categorie || "tous";
    filtrerProduits();
  });
});

function filtrerProduits() {
  const q = (searchInput?.value || "").toLowerCase().trim();
  const result = tousLesProduits.filter((p) => {
    const matchText =
      p.nom.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q);
    const matchCat = categorieActive === "tous" || p.categorie === categorieActive;
    return matchText && matchCat;
  });
  afficherProduits(result);
}

// ----------------------------
// Délégation clic: Ajouter au panier
// ----------------------------
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-add-to-cart]");
  if (btn) {
    const id = parseInt(btn.getAttribute("data-id"), 10);
    cart.add(id, 1);
  }

  // +/– quantité dans le panier
  const incBtn = e.target.closest("[data-cart-inc]");
  if (incBtn) {
    const id = parseInt(incBtn.getAttribute("data-cart-inc"), 10);
    cart.inc(id);
  }
  const decBtn = e.target.closest("[data-cart-dec]");
  if (decBtn) {
    const id = parseInt(decBtn.getAttribute("data-cart-dec"), 10);
    cart.dec(id);
  }
  const rmBtn = e.target.closest("[data-cart-remove]");
  if (rmBtn) {
    const id = parseInt(rmBtn.getAttribute("data-cart-remove"), 10);
    cart.remove(id);
  }
});

// Changement direct quantité via input
cartItemsEl?.addEventListener("change", (e) => {
  const input = e.target;
  if (input && input.matches("[data-cart-qty]")) {
    const id = parseInt(input.getAttribute("data-cart-qty"), 10);
    cart.setQty(id, input.value);
  }
});

// Vider le panier
btnClearCart?.addEventListener("click", () => {
  cart.clear();
});

// Checkout (démo) vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv


// ----------------------------
// Rendu du panier (offcanvas)
// ----------------------------
function renderCart() {
  // compteur badge
  cartCountBadge.textContent = cart.count();

  if (cart.items.length === 0) {
    cartItemsEl.innerHTML = `
      <p class="text-muted">Votre panier est vide.</p>
    `;
    cartTotalEl.textContent = formatPrice(0);
    return;
  }

  cartItemsEl.innerHTML = cart.items.map((it) => {
    const p = produitsById.get(it.id);
    if (!p) return "";
    const unit = parsePrice(p.prix);
    const lineTotal = unit * it.qty;

    return `
      <div class="cart-item">
        <img src="${p.image}" alt="${p.nom}">
        <div>
          <div class="name">${p.nom}</div>
          <div class="text-muted small">${p.prix}</div>
          <div class="mt-2 d-flex align-items-center gap-2">
            <div class="qty-control">
              <button type="button" aria-label="Diminuer" data-cart-dec="${p.id}">−</button>
              <input type="number" min="1" value="${it.qty}" data-cart-qty="${p.id}">
              <button type="button" aria-label="Augmenter" data-cart-inc="${p.id}">+</button>
            </div>
            <button class="btn-remove" title="Retirer" data-cart-remove="${p.id}">Retirer</button>
          </div>
        </div>
        <div class="price">${formatPrice(lineTotal)}</div>
      </div>
    `;
  }).join("");

  cartTotalEl.textContent = formatPrice(cart.total());
}

// ----------------------------
// Toast “ajouté au panier”
// ----------------------------


// ----------------------------
// validation de commande
// ----------------------------
let toastAdd;
function showToastAdd() {
  if (!toastAdd) {
    const el = document.getElementById("toast-add");
    if (!el) return;
    toastAdd = new bootstrap.Toast(el, { delay: 1500 });
  }
  toastAdd.show();
}
const checkoutModal = document.getElementById("checkoutModal");
const btnCancelCheckout = document.getElementById("btnCancelCheckout");
const btnConfirmCheckout = document.getElementById("btnConfirmCheckout");


btnCheckout?.addEventListener("click", () => {
if (cart.items.length === 0) {
alert("Votre panier est vide.");
return;
}

// Fermer le offcanvas panier proprement avant d'afficher le modal
  const offcanvasCartEl = document.getElementById("offcanvasCart");
  if (offcanvasCartEl) {
    const offcanvasCart = bootstrap.Offcanvas.getInstance(offcanvasCartEl);
    if (offcanvasCart) {
      offcanvasCart.hide();
    }
  }

checkoutModal.classList.remove("hidden");

// Focus sur le premier champ
  const nomInput = document.getElementById("nomClient");
  if (nomInput) {
    requestAnimationFrame(() => {
      nomInput.focus();
    });
  }


});


btnCancelCheckout.addEventListener("click", () => {
checkoutModal.classList.add("hidden");
});

btnConfirmCheckout.addEventListener("click", async () => {
  const nom = document.getElementById("nomClient").value.trim();
  const email = document.getElementById("emailClient").value.trim();
  const tel = document.getElementById("telClient").value.trim();
  const adresse = document.getElementById("adresseClient").value.trim();

  if (!nom || !email || !adresse) {
    alert("Veuillez remplir tous les champs.");
    return;
  }

  const customer = {
    name: nom,
    email,
    phone: tel,
    address: adresse,
  };

  const items = cart.items.map(it => {
    const p = produitsById.get(it.id);
    const unitPrice = parsePrice(p.prix);
    return {
      name: p.nom,
      qty: it.qty,
      unitPrice,
      lineTotal: unitPrice * it.qty,
    };
  });

  const total = cart.total();

  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer, items, total }),
    });

    const data = await res.json();
    if (data.ok) {
      alert("Merci ! Votre commande a été envoyée.");
      cart.clear();
      checkoutModal.classList.add("hidden");
    } else {
      alert("Erreur: " + (data.error || data.errors?.join(", ") || "Inconnue"));
    }
  } catch (err) {
    alert("Impossible d’envoyer la commande.");
    console.error(err);
  }
});

