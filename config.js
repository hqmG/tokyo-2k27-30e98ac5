// Konfiguration: Google Sheets-bladet som planen läses från, samt typer, färger och etiketter för kartan, tidslinjen och teckenförklaringen.
// Nyckeln är värdet i bladets kolumn "type". Typer som saknas här visas som Other.
window.CONFIG = {
  sheet: { id: "1GuYIA1zDnEMxz6cnNgzt8dHVtd0-GzT48RjtsS8q46o", name: "Plan", areas: "Areas" },   // bladets id, fliken med planen och fliken med områdesinformation
  types: {
    transport: { label: "Transport", color: "#2563eb" },
    hotel:     { label: "Hotel",     color: "#7c3aed" },
    food:      { label: "Food",      color: "#16a34a" },
    shopping:  { label: "Shopping",  color: "#db2777" },
    other:     { label: "Other",     color: "#64748b" }
  },
  // Områden som ritas på kartan. Varje område består av hela stadsdelar (ku), vars gränser finns i wards.js.
  // wards: kommunkod → stadsdelar i den ku som visas i tooltip. Bara de ku som listas här ritas.
  // Varje stadsdel har en egen rad i bladets flik Areas (id = stadsdelens namn med små bokstäver) med beskrivning per kategori.
  // city: staden vars händelser och förslag visas på kartan när man klickar på en stadsdel.
  regions: [
    { name: "West Tokyo", city: "Tokyo", color: "#14b8a6", wards: {
      "13104": "Shinjuku",
      "13113": "Shibuya, Harajuku, Omotesando, Ebisu",
      "13110": "Nakameguro",
      "13112": "Shimokitazawa",
      "13115": "Koenji" } },
    { name: "Central Tokyo", city: "Tokyo", color: "#eab308", wards: {
      "13101": "Marunouchi, Tokyo Station, Akihabara",
      "13102": "Ginza, Tsukiji",
      "13103": "Roppongi, Azabudai, Shinagawa Station, Odaiba (Daiba)" } },
    { name: "East Tokyo", city: "Tokyo", color: "#f97316", wards: {
      "13106": "Asakusa, Ueno, Yanaka",
      "13108": "Kiyosumi-Shirakawa, Odaiba (Aomi)" } },
    { name: "South Tokyo", city: "Tokyo", color: "#3b82f6", wards: {
      "13109": "Gotanda, Oimachi, Meguro Station" } }
  ]
};
