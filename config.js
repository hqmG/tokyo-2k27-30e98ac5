// Konfiguration: typer, färger och etiketter för kartan, tidslinjen och teckenförklaringen.
// Nyckeln är värdet i bladets kolumn "type". Typer som saknas här visas som Other.
window.CONFIG = {
  types: {
    transport: { label: "Transport", color: "#2563eb" },
    hotel:     { label: "Hotel",     color: "#7c3aed" },
    food:      { label: "Food",      color: "#16a34a" },
    shopping:  { label: "Shopping",  color: "#db2777" },
    other:     { label: "Other",     color: "#64748b" }
  }
};
