import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./mes-assiettes.css";

const STORAGE_KEY = "mes-assiettes-v1";
const CATEGORIES = [
  {
    key: "veg",
    label: "Légumes",
    one: "légume",
    article: "un",
    empty: "Aucun légume",
    placeholder: "ex. brocoli"
  },
  {
    key: "prot",
    label: "Protéines",
    one: "protéine",
    article: "une",
    empty: "Aucune protéine",
    placeholder: "ex. poulet"
  },
  {
    key: "fec",
    label: "Féculents",
    one: "féculent",
    article: "un",
    empty: "Aucun féculent",
    placeholder: "ex. riz"
  }
];
const CATEGORY_KEYS = CATEGORIES.map(({ key }) => key);
const EXAMPLES = {
  veg: ["Poireaux", "Courgette", "Haricots verts", "Carottes", "Poivrons", "Champignons", "Chou-fleur"],
  prot: ["Poulet", "Œufs", "Saumon", "Thon", "Crevettes", "Bœuf haché"],
  fec: ["Riz", "Pâtes", "Pommes de terre", "Semoule", "Patates douces", "Nouilles de riz"]
};

function createId() {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createEmptyData() {
  return { veg: [], prot: [], fec: [], plats: [] };
}

function normalizeDish(dish) {
  if (!dish || typeof dish !== "object") return null;
  if (CATEGORY_KEYS.some((key) => typeof dish[key] !== "string" || !dish[key].trim())) return null;

  return {
    id: typeof dish.id === "string" && dish.id ? dish.id : createId(),
    veg: dish.veg.trim(),
    prot: dish.prot.trim(),
    fec: dish.fec.trim(),
    nom: typeof dish.nom === "string" ? dish.nom.slice(0, 90) : ""
  };
}

function normalizeData(value) {
  const source = value && typeof value === "object" ? value : {};
  const normalized = createEmptyData();

  CATEGORY_KEYS.forEach((key) => {
    const seen = new Set();
    normalized[key] = Array.isArray(source[key])
      ? source[key].reduce((items, name) => {
        if (typeof name !== "string" || !name.trim()) return items;
        const cleanName = name.trim().replace(/\s+/g, " ").slice(0, 40);
        const normalizedName = cleanName.toLocaleLowerCase();
        if (!cleanName || seen.has(normalizedName) || items.length >= 80) return items;
        seen.add(normalizedName);
        items.push(cleanName);
        return items;
      }, [])
      : [];
  });
  normalized.plats = Array.isArray(source.plats)
    ? source.plats.map(normalizeDish).filter(Boolean).slice(0, 300)
    : [];
  return normalized;
}

function readLocalData() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      return { data: normalizeData(JSON.parse(saved)), message: "" };
    }
    return {
      data: { ...createEmptyData(), veg: [...EXAMPLES.veg], prot: [...EXAMPLES.prot], fec: [...EXAMPLES.fec] },
      message: ""
    };
  } catch (error) {
    console.error("Impossible de lire les données locales.", error);
    return {
      data: { ...createEmptyData(), veg: [...EXAMPLES.veg], prot: [...EXAMPLES.prot], fec: [...EXAMPLES.fec] },
      message: "Les données locales n'ont pas pu être lues. Des exemples sont affichés."
    };
  }
}

function pickIngredient(choices, current = null) {
  if (!choices.length) return null;
  if (choices.length === 1) return choices[0];
  const alternatives = choices.filter((name) => name !== current);
  return alternatives[Math.floor(Math.random() * alternatives.length)];
}

function createSearchLinks(protein, vegetable, starch) {
  const query = [protein, vegetable, starch].join(" ");
  return (
    <>
      <a
        className="link"
        href={`https://www.marmiton.org/recettes/recherche.aspx?aqt=${encodeURIComponent(query)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Marmiton
      </a>
      <a
        className="link"
        href={`https://www.google.com/search?q=${encodeURIComponent(`recette ${query}`)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Google
      </a>
    </>
  );
}

function CategoryCard({ category, ingredients, onAdd, onRemove }) {
  const { key, label, one, article, empty, placeholder } = category;
  const [value, setValue] = useState("");

  function submit(event) {
    event.preventDefault();
    onAdd(key, value);
    setValue("");
  }

  return (
    <div className="cat">
      <div className="cat-head">
        <span className={`tag k-${key}`}><span className="dot" />{label}</span>
        <span className="count">{ingredients.length}</span>
      </div>
      <div className="chips">
        {ingredients.length === 0 && <p className="empty">{empty} pour l'instant.</p>}
        {ingredients.map((name) => (
          <span className={`chip ${key}`} key={name}>
            <span>{name}</span>
            <button type="button" aria-label={`Retirer ${name}`} onClick={() => onRemove(key, name)}>×</button>
          </span>
        ))}
      </div>
      <form className="add" onSubmit={submit}>
        <input
          type="text"
          maxLength="40"
          placeholder={placeholder}
          aria-label={`Ajouter ${article} ${one}`}
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button className="btn" type="submit">Ajouter</button>
      </form>
    </div>
  );
}

function App() {
  const [initialData] = useState(readLocalData);
  const [data, setData] = useState(initialData.data);
  const [current, setCurrent] = useState(() => Object.fromEntries(
    CATEGORY_KEYS.map((key) => [key, pickIngredient(initialData.data[key])])
  ));
  const [status, setStatus] = useState(initialData.message);
  const [filter, setFilter] = useState("");
  const [clearArmed, setClearArmed] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState("");
  const clearTimer = useRef(null);
  const resetTimer = useRef(null);
  const saveTimer = useRef(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setStatus("Tes changements sont gardés sur cet appareil.");
    } catch (error) {
      console.error("Impossible d'enregistrer les données localement.", error);
      setStatus("Impossible d'enregistrer les changements sur cet appareil.");
    }
  }, [data]);

  useEffect(() => () => {
    window.clearTimeout(clearTimer.current);
    window.clearTimeout(resetTimer.current);
    window.clearTimeout(saveTimer.current);
  }, []);

  function addIngredient(key, rawValue) {
    const value = String(rawValue || "").trim().replace(/\s+/g, " ");
    if (!value) return;
    const formattedValue = value.charAt(0).toLocaleUpperCase() + value.slice(1);

    if (data[key].some((item) => item.toLocaleLowerCase() === formattedValue.toLocaleLowerCase())) {
      setStatus(`${formattedValue} est déjà dans la liste.`);
      return;
    }
    if (formattedValue.length > 40 || data[key].length >= 80) {
      setStatus("La liste est complète ou le nom dépasse 40 caractères.");
      return;
    }

    setData((previous) => ({ ...previous, [key]: [...previous[key], formattedValue] }));
    setCurrent((previous) => ({
      ...previous,
      [key]: previous[key] || formattedValue
    }));
  }

  function removeIngredient(key, name) {
    const remaining = data[key].filter((item) => item !== name);
    setData((previous) => ({ ...previous, [key]: remaining }));
    setCurrent((previous) => ({
      ...previous,
      [key]: previous[key] === name ? pickIngredient(remaining) : previous[key]
    }));
  }

  function drawIngredient(key) {
    setCurrent((previous) => ({
      ...previous,
      [key]: pickIngredient(data[key], previous[key])
    }));
  }

  function rollAll() {
    setCurrent(Object.fromEntries(
      CATEGORY_KEYS.map((key) => [key, pickIngredient(data[key], current[key])])
    ));
  }

  function armAction(isArmed, setArmed, timer, action) {
    if (isArmed) {
      window.clearTimeout(timer.current);
      setArmed(false);
      action();
      return;
    }
    setArmed(true);
    timer.current = window.setTimeout(() => setArmed(false), 4000);
  }

  function clearIngredients() {
    setData((previous) => ({ ...previous, veg: [], prot: [], fec: [] }));
    setCurrent({ veg: null, prot: null, fec: null });
  }

  function restoreExamples() {
    setData((previous) => ({
      ...previous,
      veg: [...EXAMPLES.veg],
      prot: [...EXAMPLES.prot],
      fec: [...EXAMPLES.fec]
    }));
    setCurrent(Object.fromEntries(
      CATEGORY_KEYS.map((key) => [key, pickIngredient(EXAMPLES[key])])
    ));
  }

  function saveDish() {
    if (!CATEGORY_KEYS.every((key) => current[key] && data[key].includes(current[key]))) return;
    const duplicate = data.plats.some((dish) => CATEGORY_KEYS.every(
      (key) => dish[key].toLocaleLowerCase() === current[key].toLocaleLowerCase()
    ));
    if (duplicate) {
      setSaveFeedback("Déjà dans mes plats");
    } else if (data.plats.length >= 300) {
      setSaveFeedback("La liste de plats est complète");
      return;
    } else {
      setData((previous) => ({
        ...previous,
        plats: [{ id: createId(), veg: current.veg, prot: current.prot, fec: current.fec, nom: "" }, ...previous.plats]
      }));
      setSaveFeedback("Plat enregistré");
    }
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => setSaveFeedback(""), 1600);
  }

  function deleteDish(id) {
    setData((previous) => ({ ...previous, plats: previous.plats.filter((dish) => dish.id !== id) }));
  }

  const ready = CATEGORY_KEYS.every((key) => current[key] && data[key].includes(current[key]));
  const dishIngredients = [...new Set(data.plats.flatMap(({ veg, prot, fec }) => [veg, prot, fec]))]
    .sort((first, second) => first.localeCompare(second, "fr"));
  const visibleDishes = data.plats.filter((dish) => (
    !filter || CATEGORY_KEYS.some((key) => dish[key] === filter)
  ));

  return (
    <div className="wrap">
      <header className="hero">
        <h1>Mes assiettes</h1>
        <p className="lede">Légume, protéine, féculent : on fait avec ce qu'il y a.</p>
        <p className="sync" aria-live="polite">{status}</p>
      </header>

      <section aria-labelledby="h-sel">
        <div className="sec-head ingredients-head">
          <div>
            <h2 id="h-sel">Mes ingrédients</h2>
            <p>Ce qu'il y a dans les placards et le bac à légumes.</p>
          </div>
          <div className="ingredient-actions">
            <button
              className="btn small"
              type="button"
              onClick={() => armAction(resetArmed, setResetArmed, resetTimer, restoreExamples)}
            >
              {resetArmed ? "Confirmer : réinitialiser" : "Réinitialiser les exemples"}
            </button>
            <button
              className="btn small"
              type="button"
              onClick={() => armAction(clearArmed, setClearArmed, clearTimer, clearIngredients)}
            >
              {clearArmed ? "Confirmer : tout vider" : "Tout vider"}
            </button>
          </div>
        </div>
        <div className="cats">
          {CATEGORIES.map((category) => (
            <CategoryCard
              key={category.key}
              category={category}
              ingredients={data[category.key]}
              onAdd={addIngredient}
              onRemove={removeIngredient}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="h-plate">
        <div className="sec-head">
          <h2 id="h-plate">Composer un repas</h2>
          <p>Une combinaison au hasard. Possible de changer chaque élément.</p>
        </div>
        <div className="plate">
          <div className="tiles">
            {CATEGORIES.map(({ key, one, article }) => {
              const ingredient = current[key];
              return (
                <div className={`tile ${key}`} key={key}>
                  <div className="tile-top">
                    <span className={`tag k-${key}`}><span className="dot" />{one}</span>
                    <button
                      className="reroll"
                      type="button"
                      aria-label={`Relancer ${article === "une" ? "la" : "le"} ${one}`}
                      disabled={data[key].length < 2}
                      onClick={() => drawIngredient(key)}
                    >
                      Relancer
                    </button>
                  </div>
                  <div className={`val${ingredient ? "" : " ph"}`}>
                    {ingredient || `Ajoute ${article} ${one} dans ta liste.`}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="plate-actions">
            <button className="btn primary" type="button" disabled={!CATEGORY_KEYS.every((key) => data[key].length)} onClick={rollAll}>
              Tirer au sort
            </button>
            <button className="btn" type="button" disabled={!ready} onClick={saveDish}>
              {saveFeedback || "Enregistrer ce plat"}
            </button>
            {ready && (
              <span className="links">
                <span className="count">Chercher des recettes :</span>
                {createSearchLinks(current.prot, current.veg, current.fec)}
              </span>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="h-plats">
        <div className="sec-head">
          <h2 id="h-plats">Mes plats favoris</h2>
          <p>Les assiettes à refaire un autre jour.</p>
        </div>
        {data.plats.length >= 2 && (
          <div className="filter">
            <label htmlFor="filter">Filtrer par ingrédient</label>
            <select id="filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="">Tous les plats</option>
              {dishIngredients.map((name) => <option value={name} key={name}>{name}</option>)}
            </select>
          </div>
        )}
        <div className="list">
          {data.plats.length === 0
            ? <p className="empty">Aucun plat gardé pour l'instant.</p>
            : visibleDishes.map((dish) => {
              const title = dish.nom || `${dish.prot}, ${dish.veg}, ${dish.fec}`;
              return (
                <div className="card" key={dish.id}>
                  <div className="card-top">
                    <h3>{title}</h3>
                    <button className="x" type="button" aria-label={`Supprimer ${title}`} onClick={() => deleteDish(dish.id)}>×</button>
                  </div>
                  <div className="parts">
                    <span><span className="dot k-prot" />{dish.prot}</span>
                    <span><span className="dot k-veg" />{dish.veg}</span>
                    <span><span className="dot k-fec" />{dish.fec}</span>
                  </div>
                  <div className="card-foot">{createSearchLinks(dish.prot, dish.veg, dish.fec)}</div>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
