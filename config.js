// Konfiguration: typer, färger och etiketter för kartan, tidslinjen och teckenförklaringen.
// Lägg till en ny typ här när en ny kategori (restaurang, shopping osv.) ska visas.
window.CONFIG = {
  types: {
    transport:  { label: "Transport", color: "#2563eb" },
    boende:     { label: "Hotel",     color: "#7c3aed" },
    restaurang: { label: "Food",      color: "#16a34a" },
    shopping:   { label: "Shopping",  color: "#db2777" },
    other:      { label: "Other",     color: "#64748b" }
  }
};
