/* Comptabilité — vue Budget, saisie enrichie (récurrences, magasin, ticket, articles, virements), Courses, Comptes */

let REC = [], ITEMS = [];
const STORES = ["Carrefour","Carrefour Market","Carrefour City","Leclerc","Auchan","Lidl","Aldi","Intermarché","Monoprix","Franprix","Casino","Super U","Hyper U","Picard","G20","Biocoop","Grand Frais","Action","Netto","Leader Price","Naturalia","Cora","Match","Spar","Proxi","Utile","Marché"];
const FAMILIES = ["Fruits & légumes","Viande & poisson","Produits laitiers","Féculents & céréales","Épicerie","Boissons","Surgelés","Bébé","Hygiène & maison"];
const NON_FOOD = new Set(["Hygiène & maison"]);
const FAMILY_WORDS = [
  ["Fruits & légumes", /pomme|poire|banane|orange|citron|clementine|mandarine|kiwi|raisin|fraise|melon|pasteque|ananas|mangue|avocat|tomate|carotte|courgette|aubergine|poivron|salade|laitue|epinard|brocoli|chou|oignon|ail|echalote|poireau|pomme de terre|patate|champignon|concombre|haricot vert|legume|fruit|persil|coriandre|menthe|gingembre|patate douce|butternut|potiron/],
  ["Viande & poisson", /poulet|dinde|boeuf|bœuf|steak|hache|viande|porc|jambon|lardon|saucisse|merguez|agneau|veau|escalope|cuisse|filet|blanc de|saumon|thon|cabillaud|colin|crevette|poisson|sardine|maquereau|oeuf|œuf|oeufs/],
  ["Produits laitiers", /lait|yaourt|yogourt|skyr|fromage|emmental|comte|comté|mozzarella|feta|chevre|chèvre|beurre|creme|crème|fromage blanc|petit suisse|camembert|parmesan|ricotta|kefir/],
  ["Féculents & céréales", /riz|pates|pâtes|spaghetti|penne|semoule|quinoa|boulgour|lentille|pois chiche|haricot rouge|flocon|avoine|muesli|cereale|céréale|pain|baguette|farine|wrap|tortilla|biscotte/],
  ["Boissons", /\beau\b|cristaline|evian|volvic|jus|soda|coca|cola|sirop|cafe|café|the |thé|biere|bière|vin |limonade|ice tea|oasis/],
  ["Surgelés", /surgele|surgelé|glace|picard/],
  ["Bébé", /couche|lingette|bebe|bébé|blédina|bledina|lait infantile|guigoz|gallia|pampers|petit pot/],
  ["Hygiène & maison", /savon|gel douche|shampo|dentifrice|brosse|deodorant|déodorant|papier toilette|essuie|sopalin|lessive|adoucissant|liquide vaisselle|eponge|éponge|sac poubelle|nettoyant|javel|coton|rasoir|mouchoir|aluminium|film/],
];
const guessFamily = name => { const n = " " + (name || "").toLowerCase() + " "; for (const [f, re] of FAMILY_WORDS) if (re.test(n)) return f; return "Épicerie"; };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayIso = () => iso(new Date());
const monthsBetween = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)) + 1;
const accName = id => (ACC.find(a => a.id === id) || {}).name || "";
const isTransfer = t => t.group === "transfert";
const num = v => { const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : null; };

const monthLabel = k => new Date(k.slice(0, 7) + "-01T12:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
const addMonths = (k, n) => { let [y, m] = k.slice(0, 7).split("-").map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${String(m).padStart(2, "0")}`; };
/* mois de fin (AAAA-MM) choisi dans la saisie, ou null */
function sheetEndKey(s) {
  if (s.endMode === "date" && /^\d{4}-\d{2}/.test(s.endMonth || "")) return s.endMonth.slice(0, 7);
  if (s.endMode === "count" && +s.endCount >= 1) return addMonths(s.date, +s.endCount - 1);
  return null;
}
const dayLabel = d => d >= 31 ? "dernier jour" : d === 1 ? "1er" : String(d);
const dayOptions = sel => Array.from({ length: 31 }, (_, i) => i + 1).map(d => `<option value="${d}" ${d === sel ? "selected" : ""}>${d === 31 ? "31 (ou dernier jour du mois)" : d === 1 ? "1er" : d}</option>`).join("");
/* date du même mois au jour voulu ; si ce jour est déjà passé ce mois-ci, mois suivant */
function dateWithDay(ds, d) {
  let [y, m] = ds.split("-").map(Number); const today = todayIso();
  let last = new Date(y, m, 0).getDate(); let out = `${y}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
  if (out < today && ds.slice(0, 7) === today.slice(0, 7)) { m++; if (m > 12) { m = 1; y++; } last = new Date(y, m, 0).getDate(); out = `${y}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`; }
  return out;
}

/* ===================== Gestion des récurrences (Réglages) ===================== */
function recListHtml() {
  const act = REC.filter(r => r.active).filter(r => r.scope === "foyer" || isOwner()).sort((a, b) => a.day - b.day || b.amount - a.amount);
  const accOpts = sel => `<option value="">Aucun compte</option>` + [...ACC].sort((a, b) => (a.ord || 0) - (b.ord || 0)).map(a => `<option value="${a.id}" ${sel === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("");
  const totOut = sum(act.filter(r => r.type === "out" && r.scope === "foyer")), totIn = sum(act.filter(r => r.type === "in" && r.scope === "foyer"));
  return `<div><h2>Dépenses et revenus récurrents</h2><div class="card" style="display:grid;gap:4px">
    ${act.length ? `<p class="small muted" style="margin:0 0 6px">${act.length} récurrence${act.length > 1 ? "s" : ""} : ${eur(totOut)} de dépenses${totIn ? ` et ${eur(totIn)} de revenus` : ""} du foyer chaque mois.</p>` : `<p class="small muted" style="margin:0">Aucune récurrence. À la saisie d'une dépense, choisis « Chaque mois » et le jour.</p>`}
    ${act.map(r => `<div class="rec">
      <div class="rec-h"><b>${esc(r.label || r.cat)}${r.client ? ` <span class="small muted">· ${esc(r.client)}</span>` : ""}</b><span class="chip ${r.type === "in" ? "ok" : r.scope === "pro" ? "pro" : ""}">${r.type === "in" ? "Revenu" : r.scope === "pro" ? "Pro" : r.grp === "fixe" ? "Fondamental" : r.grp === "dieu" ? esc(dieuLabel()) : r.grp === "epargne" ? "Épargne" : "Variable"}</span></div>
      <div class="rec-r">
        <label class="f"><span>Jour</span><select data-rec="${r.id}" data-rk="day">${dayOptions(r.day)}</select></label>
        <label class="f"><span>Montant (€)</span><input type="text" inputmode="decimal" data-rec="${r.id}" data-rk="amount" value="${String(r.amount).replace(".", ",")}"></label>
        <label class="f"><span>Compte</span><select data-rec="${r.id}" data-rk="account_id">${accOpts(r.account_id)}</select></label>
        <label class="f"><span>Dernier mois</span><input type="month" data-rec="${r.id}" data-rk="end_month" min="${r.start_month.slice(0, 7)}" value="${r.end_month ? r.end_month.slice(0, 7) : ""}"></label>
      </div>
      <div class="small muted">Depuis ${monthLabel(r.start_month)}${r.end_month ? ` jusqu'en ${monthLabel(r.end_month)} (${monthsBetween(r.start_month, r.end_month)} fois)` : ", sans fin"} · <button class="linkbtn" data-recstop="${r.id}">Arrêter</button></div>
    </div>`).join("")}
    <p class="note" style="margin:6px 0 0">Les changements s'appliquent aux prochains mois ; les lignes déjà ajoutées ne bougent pas.</p>
  </div></div>`;
}
async function fetchAllFrom(table, order) {
  const out = []; let from = 0; const page = 1000;
  for (;;) {
    let q = sb.from(table).select("*").eq("foyer_id", FOYER);
    if (order) q = q.order(order, { ascending: false });
    const { data, error } = await q.range(from, from + page - 1);
    if (error) throw error; out.push(...data); if (data.length < page) break; from += page;
  }
  return out;
}
async function loadExtras() {
  const [rec, items] = await Promise.all([fetchAllFrom("cpta_recurring"), fetchAllFrom("cpta_items")]);
  REC = rec.map(r => ({ ...r, amount: +r.amount }));
  ITEMS = items.map(i => ({ ...i, qty: i.qty == null ? null : +i.qty, price: +i.price }));
}

/* ===================== Récurrences ===================== */
function occurrencesOf(r, untilIso) {
  const out = []; const start = new Date(r.start_month + "T12:00"); start.setDate(1);
  const endKey = r.end_month ? r.end_month.slice(0, 7) : null; const skip = new Set(r.skip || []);
  for (let i = 0, d = new Date(start); i < 60; i++, d.setMonth(d.getMonth() + 1)) {
    const y = d.getFullYear(), m = d.getMonth() + 1, k = mkey(y, m);
    if (endKey && k > endKey) break;
    const day = Math.min(r.day, new Date(y, m, 0).getDate());
    const ds = `${k}-${String(day).padStart(2, "0")}`;
    if (ds > untilIso) break;
    if (!skip.has(ds)) out.push(ds);
  }
  return out;
}
async function generateRecurring() {
  const today = todayIso(); const rows = [];
  for (const r of REC) {
    if (!r.active || (r.scope === "pro" && !isOwner())) continue;
    for (const ds of occurrencesOf(r, today)) {
      if (!TX.some(t => t.rec_id === r.id && t.date === ds))
        rows.push({ foyer_id: FOYER, date: ds, type: r.type, scope: r.scope, grp: r.grp, cat: r.cat, label: r.label, amount: r.amount, status: "paid", method: r.method || "", client: r.client || "", store: r.store || "", account_id: r.account_id, rec_id: r.id });
    }
  }
  if (!rows.length) return false;
  const { error } = await sb.from("cpta_tx").upsert(rows, { onConflict: "rec_id,date", ignoreDuplicates: true });
  return !error;
}
/* occurrences prévues plus tard dans le mois affiché (pas encore passées) */
function plannedFor(key) {
  const today = todayIso(); const last = new Date(+key.slice(0, 4), +key.slice(5), 0).getDate();
  const end = `${key}-${String(last).padStart(2, "0")}`; const out = [];
  for (const r of REC) {
    if (!r.active) continue;
    for (const ds of occurrencesOf(r, end)) if (ds.startsWith(key) && ds > today && !TX.some(t => t.rec_id === r.id && t.date === ds))
      out.push({ id: "plan-" + r.id, planned: true, rec: r, date: ds, month: key, type: r.type, scope: r.scope, group: r.grp, cat: r.cat, label: r.label, amount: r.amount, account_id: r.account_id, rec_id: r.id });
  }
  return out;
}

/* ===================== Soldes des comptes ===================== */
function accountBalance(a, atIso) {
  const open = a.opening_date || "1970-01-01";
  return a.balance + sum(TX.filter(t => t.account_id === a.id && t.date >= open && (!atIso || t.date <= atIso)), t => t.type === "in" ? t.amount : -t.amount);
}
function accountFlows(a, key) {
  const rows = TX.filter(t => t.account_id === a.id && t.month === key && t.date >= (a.opening_date || "1970-01-01"));
  return { rows, in: sum(rows.filter(t => t.type === "in")), out: sum(rows.filter(t => t.type === "out")) };
}

/* ===================== Vue Budget (façon tableur) ===================== */
function vBudget() {
  const key = curKey(), f = foyerMonth(key), sp = S.split, inc = f.incomes;
  const planned = plannedFor(key).filter(p => p.scope === "foyer");
  const pl = g => planned.filter(p => p.group === g);
  const envRows = [
    ...(sp.dieu > 0 || f.dieu > 0 ? [[dieuLabel(), sp.dieu, f.dieu, "dieu"]] : []),
    ["Épargne", sp.epargne, f.impact, "epargne"],
    ["Fondamental (besoins)", sp.fixe, f.fixe, "fixe"],
    ["Dépenses variables", sp.variable, f.variable, "variable"],
  ];
  const envTable = `<div class="card tbl"><table class="budget"><thead><tr><th></th><th>Budget</th><th>Actuel</th><th>Total</th></tr></thead><tbody>
    ${envRows.map(([l, p, v, g]) => { const b = inc * p / 100; const bad = g === "epargne" ? v < b : v > b + .005;
      return `<tr><td><span class="sw sw-${g}"></span><span>${esc(l)}<small class="obj">objectif ${p} %</small></span></td><td>${eur0(b)}</td><td>${pct(inc ? v / inc * 100 : 0)}</td><td class="${bad ? "neg" : "pos"}"><b>${eur(v)}</b></td></tr>`; }).join("")}
    <tr><td><b>Total des dépenses</b></td><td></td><td></td><td><b>${eur(f.depenses)}</b></td></tr>
    <tr><td><b>Impact réel sur l'épargne</b></td><td></td><td></td><td class="${f.impact >= 0 ? "pos" : "neg"}"><b>${eur(f.impact)}</b></td></tr>
  </tbody></table></div>`;

  const lineRow = (t, base) => {
    const pctv = base ? pct(t.amount / base * 100) : "";
    const meta = [];
    if (t.rec_id) meta.push(t.planned ? `prévu le ${+t.date.slice(8)}` : `↻ le ${+t.date.slice(8)}`);
    else meta.push(new Date(t.date + "T12:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }));
    if (t.store) meta.push(esc(t.store)); if (t.receipt_path) meta.push("ticket");
    return `<button class="bl ${t.planned ? "planned" : ""}" ${t.planned ? `data-plan="${t.rec_id}"` : `data-edit="${t.id}"`}><span class="bl-l">${esc(t.label || t.cat)}<small>${meta.join(" · ")}</small></span><span class="bl-p">${pctv}</span><span class="bl-a">${eur(t.amount)}</span></button>`;
  };
  const section = (title, g, rows, total, extra = "") => `<div class="bsec bsec-${g}"><div class="bsec-h"><b>${title}</b><span class="num">${eur(total)}</span></div>
    ${extra}${rows.length ? rows.map(t => lineRow(t, inc)).join("") : `<p class="small muted" style="margin:8px 0">Rien pour l'instant.</p>`}
    <button class="bsec-add" data-add="${g}">Ajouter</button></div>`;
  const byAmt = (a, b) => b.amount - a.amount;
  const out = g => f.rows.filter(t => t.type === "out" && t.group === g).sort(byAmt);

  const incRows = [];
  if (S.regime !== "salarie") incRows.push(`<div class="bl static"><span class="bl-l">Activité pro (net après charges)<small>calculé depuis l'onglet pro</small></span><span class="bl-p">${inc ? pct(f.proNet / inc * 100) : ""}</span><span class="bl-a">${eur(f.proNet)}</span></div>`);
  const incSec = `<div class="bsec bsec-revenu"><div class="bsec-h"><b>Revenus</b><span class="num">${eur(inc)}</span></div>
    ${incRows.join("")}${[...f.inc].sort(byAmt).map(t => lineRow(t, inc)).join("")}${pl("revenu").map(t => lineRow(t, inc)).join("")}
    <button class="bsec-add" data-add="revenu">Ajouter</button></div>`;

  const epObj = inc * sp.epargne / 100;
  const epSec = `<div class="bsec bsec-epargne"><div class="bsec-h"><b>Épargne</b><span class="num ${f.impact >= 0 ? "pos" : "neg"}">${eur(f.impact)}</span></div>
    <div class="bl static"><span class="bl-l">Prévu</span><span class="bl-p">${sp.epargne} %</span><span class="bl-a">${eur(epObj)}</span></div>
    <div class="bl static"><span class="bl-l">Réel</span><span class="bl-p">${pct(inc ? f.impact / inc * 100 : 0)}</span><span class="bl-a ${f.impact >= 0 ? "pos" : "neg"}">${eur(f.impact)}</span></div></div>`;

  const lastDay = `${key}-${String(new Date(cur.y, cur.m, 0).getDate()).padStart(2, "0")}`;
  const owed = (S.regime === "micro" || S.regime === "reel") ? urssafOwed().owed : 0;
  const accs = [...ACC].sort((a, b) => (a.ord || 0) - (b.ord || 0));
  const totAcc = sum(accs, a => accountBalance(a, lastDay));
  const futSec = `<div class="bsec bsec-futur"><div class="bsec-h"><b>Futur (économies)</b><span class="num">${eur(totAcc - owed)}</span></div>
    ${accs.map(a => `<button class="bl" data-goacc="${a.id}"><span class="bl-l">${esc(a.name)}<small>${{ courant: "Courant", epargne: "Épargne", especes: "Espèces", invest: "Investissement", dette: "Dette" }[a.kind] || ""}</small></span><span class="bl-p"></span><span class="bl-a">${eur(accountBalance(a, lastDay))}</span></button>`).join("")}
    ${owed ? `<div class="bl static"><span class="bl-l">Cotisations URSSAF à payer</span><span class="bl-p"></span><span class="bl-a neg">−${eur(owed)}</span></div>` : ""}
    <div class="bl static tot"><span class="bl-l"><b>Argent total</b></span><span class="bl-p"></span><span class="bl-a"><b>${eur(totAcc - owed)}</b></span></div></div>`;

  const plannedTotal = sum(planned.filter(p => p.type === "out"));
  return `
  <div class="card hero"><div class="lab">Impact sur l'épargne · ${MOIS[cur.m - 1]}</div><div class="big ${f.impact >= 0 ? "pos" : "neg"}">${sgn(f.impact)}</div>
  ${plannedTotal ? `<div class="small muted">Encore ${eur(plannedTotal)} de dépenses récurrentes prévues d'ici la fin du mois.</div>` : ""}</div>
  ${envTable}
  <div class="bgrid">
    ${incSec}
    ${section("Fondamental (besoins)", "fixe", [...out("fixe"), ...pl("fixe")], f.fixe)}
    ${section("Dépenses variables", "variable", [...out("variable"), ...pl("variable")], f.variable)}
    ${(sp.dieu > 0 || f.dieu > 0) ? section(esc(dieuLabel()), "dieu", [...out("dieu"), ...pl("dieu")], f.dieu) : ""}
    ${epSec}
    ${futSec}
  </div>`;
}

/* ===================== Vue Courses ===================== */
function vCourses() {
  const key = curKey(), y = cur.y;
  const isGroc = t => t.scope === "foyer" && t.type === "out" && t.cat === "Courses";
  const monthTx = TX.filter(t => isGroc(t) && t.month === key);
  const spent = sum(monthTx), trips = monthTx.length;
  const prevSpent = sum(TX.filter(t => isGroc(t) && t.month === prevKey()));
  const byStore = {}; monthTx.forEach(t => { const s = t.store || "Magasin non précisé"; byStore[s] = (byStore[s] || 0) + t.amount; });
  const txMonth = Object.fromEntries(TX.map(t => [t.id, t]));
  const itemsOf = k => ITEMS.filter(i => txMonth[i.tx_id] && txMonth[i.tx_id].month === k);
  const its = itemsOf(key);
  const food = its.filter(i => !NON_FOOD.has(i.family));
  const kg = sum(food.filter(i => i.unit === "kg"), i => i.qty || 0), litres = sum(food.filter(i => i.unit === "l"), i => i.qty || 0);
  const byFam = {}; its.forEach(i => { byFam[i.family] = (byFam[i.family] || 0) + i.price; });
  const famMax = Math.max(1, ...Object.values(byFam));
  const prod = {}; its.forEach(i => { const k = i.name.toLowerCase(); const p = prod[k] = prod[k] || { name: i.name, price: 0, qty: 0, unit: i.unit, n: 0 }; p.price += i.price; p.qty += i.qty || 0; p.n++; });
  const top = Object.values(prod).sort((a, b) => b.price - a.price).slice(0, 10);
  const persons = +S.persons || 0; const days = new Date(cur.y, cur.m, 0).getDate();
  // année
  const months = Array.from({ length: 12 }, (_, i) => { const k = mkey(y, i + 1); const m = TX.filter(t => isGroc(t) && t.month === k); const fi = itemsOf(k).filter(x => !NON_FOOD.has(x.family) && x.unit === "kg"); return { i, k, spent: sum(m), kg: sum(fi, x => x.qty || 0) }; });
  const maxS = Math.max(1, ...months.map(m => m.spent)); const W = 600, H = 150, pb = 22, bw = W / 12;
  const ticks = niceTicks(maxS), top_ = ticks.at(-1);
  const chart = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Dépenses de courses par mois">${ticks.map(t => { const yy = H - pb - (t / top_) * (H - pb - 8); return `<line x1="0" x2="${W}" y1="${yy}" y2="${yy}" stroke="var(--line)"/><text x="${W - 2}" y="${Math.max(11, yy - 3)}" text-anchor="end">${t}</text>`; }).join("")}
    ${months.map(m => { const h = (m.spent / top_) * (H - pb - 8); const x = m.i * bw + bw * .2, w = bw * .6; return `<rect x="${x}" y="${H - pb - h}" width="${w}" height="${h}" rx="2" fill="var(--foyer)" opacity="${m.k === key ? 1 : .55}"/><text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${MOIS[m.i].slice(0, 3)}</text>`; }).join("")}</svg>`;
  const unitLbl = u => u === "kg" ? "kg" : u === "l" ? "L" : "u.";
  return `
  <div class="card hero"><div class="lab">Courses · ${MOIS[cur.m - 1]}</div><div class="big">${eur(spent)}</div>
    <div class="small muted">${prevSpent ? `Mois précédent : <span class="num">${eur(prevSpent)}</span>` : ""}</div>
    <div class="flow"><div><div class="k">Passages</div><div class="v">${trips}</div></div><div><div class="k">Panier moyen</div><div class="v">${eur(trips ? spent / trips : 0)}</div></div><div><div class="k">Nourriture</div><div class="v">${kg ? kg.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " kg" : "—"}${litres ? " · " + litres.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " L" : ""}</div></div></div>
    ${persons && kg ? `<p class="small muted" style="margin:8px 0 0">Soit ${(kg / persons / days * 1000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} g de nourriture pesée par personne et par jour, pour ${persons} personne${persons > 1 ? "s" : ""}.</p>` : ""}
  </div>
  ${!its.length ? `<div class="alert"><span class="dot"></span><div>Ajoute la photo du ticket quand tu saisis tes courses : l'app lit les articles, et tu obtiens ici les kilos achetés, les prix au kilo et tes produits les plus chers.</div></div>` : ""}
  <div class="grid2">
    <div><h2>Par magasin</h2><div class="card rows">${Object.entries(byStore).sort((a, b) => b[1] - a[1]).map(([s, v]) => `<div class="row"><div class="t">${esc(s)}</div><div class="s">${pct(spent ? v / spent * 100 : 0)} du mois</div><div class="amt">${eur(v)}</div></div>`).join("") || '<p class="muted">Aucune course ce mois-ci.</p>'}</div></div>
    <div><h2>Par famille d'articles</h2><div class="card env">${Object.entries(byFam).sort((a, b) => b[1] - a[1]).map(([fm, v]) => `<div class="env-row"><div class="env-head"><b>${esc(fm)}</b><span class="num">${eur(v)}</span></div><div class="bar"><i style="width:${v / famMax * 100}%;background:var(--foyer)"></i></div></div>`).join("") || '<p class="muted">Pas encore d\'articles lus ce mois-ci.</p>'}</div></div>
  </div>
  ${top.length ? `<div><h2>Produits du mois</h2><div class="card tbl"><table><thead><tr><th>Produit</th><th>Quantité</th><th>Dépensé</th><th>Prix au kg / L</th></tr></thead><tbody>
    ${top.map(p => `<tr><td>${esc(p.name)}</td><td>${p.qty ? p.qty.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " " + unitLbl(p.unit) : p.n + " u."}</td><td>${eur(p.price)}</td><td>${(p.unit === "kg" || p.unit === "l") && p.qty ? eur(p.price / p.qty) : "—"}</td></tr>`).join("")}</tbody></table></div></div>` : ""}
  <div><h2>Courses ${y}</h2><div class="card">${chart}
    <div class="tbl" style="margin-top:8px"><table><thead><tr><th>Mois</th><th>Dépensé</th><th>Nourriture pesée</th></tr></thead><tbody>${months.filter(m => m.spent || m.kg).map(m => `<tr class="${m.k === key ? "cur" : ""}"><td>${MOIS[m.i]}</td><td>${eur0(m.spent)}</td><td>${m.kg ? m.kg.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " kg" : "—"}</td></tr>`).join("")}</tbody></table></div></div></div>
  <div><h2>Suivre le prix d'un produit</h2><div class="card" style="display:grid;gap:10px">
    <input type="search" id="prodq" placeholder="ex. poulet, lait, bananes" value="${esc(window._prodq || "")}">
    <div id="prodres">${prodHistory(window._prodq || "")}</div>
    <label class="f" style="max-width:220px"><span>Personnes au foyer</span><input type="number" id="s_persons" min="1" value="${persons || ""}" placeholder="ex. 4" ${isOwner() ? "" : "disabled"}></label>
  </div></div>`;
}
function prodHistory(q) {
  q = (q || "").trim().toLowerCase(); if (q.length < 2) return `<p class="small muted" style="margin:0">Tape au moins 2 lettres pour voir l'historique de prix.</p>`;
  const txById = Object.fromEntries(TX.map(t => [t.id, t]));
  const rows = ITEMS.filter(i => i.name.toLowerCase().includes(q) && txById[i.tx_id]).map(i => ({ ...i, t: txById[i.tx_id] })).sort((a, b) => b.t.date.localeCompare(a.t.date)).slice(0, 30);
  if (!rows.length) return `<p class="small muted" style="margin:0">Aucun article trouvé.</p>`;
  return `<div class="tbl"><table><thead><tr><th>Date</th><th>Article</th><th>Magasin</th><th>Prix</th><th>€/kg ou L</th></tr></thead><tbody>${rows.map(r => `<tr><td>${new Date(r.t.date + "T12:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</td><td style="font-family:var(--body)">${esc(r.name)}</td><td style="font-family:var(--body)">${esc(r.t.store || "—")}</td><td>${eur(r.price)}</td><td>${(r.unit !== "u") && r.qty ? eur(r.price / r.qty) : "—"}</td></tr>`).join("")}</tbody></table></div>`;
}

/* ===================== Vue Comptes ===================== */
function vComptes() {
  const key = curKey(); const accs = [...ACC].sort((a, b) => (a.ord || 0) - (b.ord || 0));
  const owed = (S.regime === "micro" || S.regime === "reel") ? urssafOwed().owed : 0;
  const now = accs.map(a => ({ a, bal: accountBalance(a), fl: accountFlows(a, key) }));
  const tot = sum(now, x => x.bal);
  const firstOpen = accs.map(a => a.opening_date || "").sort()[0] || "";
  const unassigned = TX.filter(t => t.month === key && t.scope === "foyer" && !t.account_id && !isTransfer(t) && t.date >= firstOpen).length;
  const ms = Array.from({ length: 12 }, (_, i) => foyerMonth(mkey(cur.y, i + 1))).filter(m => m.fixe > 0);
  const fixAvg = ms.length ? sum(ms, m => m.fixe + m.dieu) / ms.length : 0;
  const epar = sum(now.filter(x => x.a.kind === "epargne"), x => x.bal); const cushion = fixAvg ? epar / fixAvg : 0;
  const open = window._accOpen;
  const kinds = [["courant", "Courant"], ["epargne", "Épargne"], ["especes", "Espèces"], ["invest", "Investissement"], ["dette", "Dette"]];
  return `
  <div class="card hero"><div class="lab">Argent disponible après URSSAF dû</div><div class="big ${tot - owed >= 0 ? "" : "neg"}">${eur(tot - owed)}</div>
    <div class="flow"><div><div class="k">Total des comptes</div><div class="v">${eur(tot)}</div></div><div><div class="k">URSSAF à mettre de côté</div><div class="v ${owed ? "neg" : ""}">${eur(owed)}</div></div><div><div class="k">Coussin de sécurité</div><div class="v">${cushion.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} mois</div></div></div>
    <div class="toolbar" style="margin-top:12px"><button class="btn" id="doTransfer">Faire un virement entre comptes</button></div></div>
  ${unassigned ? `<div class="alert warn"><span class="dot"></span><div>${unassigned} ligne${unassigned > 1 ? "s" : ""} de ${MOIS[cur.m - 1]} sans compte : elles ne modifient aucun solde. Choisis le compte en ouvrant la ligne.</div></div>` : ""}
  <div class="grid2">${now.map(({ a, bal, fl }) => `
    <div class="card acc">
      <button class="acc-h" data-accopen="${a.id}"><span><b>${esc(a.name)}</b><small>${(kinds.find(k => k[0] === a.kind) || [, ""])[1]}</small></span><span class="num big2 ${bal < 0 ? "neg" : ""}">${eur(bal)}</span></button>
      <div class="kv small"><span>Entrées ${MOIS[cur.m - 1]}</span><span class="num ${fl.in ? "pos" : "muted"}">${fl.in ? "+" : ""}${eur(fl.in)}</span><span>Sorties ${MOIS[cur.m - 1]}</span><span class="num ${fl.out ? "" : "muted"}">${fl.out ? "−" : ""}${eur(fl.out)}</span></div>
      ${open === a.id ? `<div class="acc-d">
        ${fl.rows.length ? `<div class="rows">${[...fl.rows].sort((x, y) => y.date.localeCompare(x.date)).map(txRow).join("")}</div>` : `<p class="small muted">Aucun mouvement ce mois-ci.</p>`}
        <div class="fgrid" style="align-items:end;margin-top:10px">
          <label class="f"><span>Nom</span><input type="text" data-accf="name" data-id="${a.id}" value="${esc(a.name)}"></label>
          <label class="f"><span>Type</span><select data-accf="kind" data-id="${a.id}">${kinds.map(([v, l]) => `<option value="${v}" ${a.kind === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="f"><span>Solde réel aujourd'hui (€)</span><input type="number" step="0.01" inputmode="decimal" id="adj-${a.id}" placeholder="${bal.toFixed(2)}"></label>
          <button class="btn" data-adjust="${a.id}">Ajuster le solde</button>
        </div>
        <p class="note" style="margin:6px 0 0">Ajuster recale le solde sur ta banque sans créer de dépense. Les mouvements comptent à partir du ${new Date((a.opening_date || todayIso()) + "T12:00").toLocaleDateString("fr-FR")}.</p>
      </div>` : `<button class="linkbtn small" data-accopen="${a.id}" style="justify-self:start">Voir les mouvements et réglages</button>`}
    </div>`).join("")}</div>
  <div class="toolbar"><button class="btn" id="addAcc2">Ajouter un compte</button></div>`;
}

/* ===================== Saisie ===================== */
let sheetFile = null, sheetItems = [], sheetPrevUrl = null;
function defaultAccount() { let id = null; try { id = localStorage.getItem("compta.acc." + FOYER); } catch (e) {} if (id && ACC.some(a => a.id === id)) return id; const c = ACC.find(a => a.kind === "courant"); return c ? c.id : (ACC[0] || {}).id || ""; }
function openSheet(t, preset) {
  const isNew = !t; sheetFile = null; if (sheetPrevUrl) { URL.revokeObjectURL(sheetPrevUrl); sheetPrevUrl = null; }
  if (t && t.planned) { t = null; preset = { ...preset }; }
  if (t) {
    sheet = { ...t, mode: isTransfer(t) ? "transfer" : t.type };
    if (sheet.mode === "transfer") { const o = TX.find(x => x.transfer_id === t.transfer_id && x.id !== t.id); const out = t.type === "out" ? t : o, inn = t.type === "in" ? t : o; sheet.from = out ? out.account_id : ""; sheet.to = inn ? inn.account_id : ""; }
    sheet.freq = t.rec_id ? "month" : "once";
    sheetItems = ITEMS.filter(i => i.tx_id === t.id).map(i => ({ ...i }));
  } else {
    sheet = { mode: "out", type: "out", scope: "foyer", group: "variable", cat: "Courses", label: "", amount: "", date: todayIso(), status: "paid", method: "", client: "", store: "", account_id: defaultAccount(), freq: "once", from: defaultAccount(), to: "", ...(preset || {}) };
    if (!sheet.date.startsWith(curKey()) && !(preset && preset.date)) sheet.date = curKey() === todayIso().slice(0, 7) ? todayIso() : curKey() + "-01";
    sheetItems = [];
  }
  drawSheet(isNew);
}
function drawSheet(isNew, confirmDel) {
  const s = sheet; if (!s) return; const ro = !isNew && !canEdit(s);
  const tr = s.mode === "transfer";
  if (!tr) { s.type = s.mode; }
  const groups = tr ? [] : Object.keys(CATS[s.scope][s.type]); if (!tr && !groups.includes(s.group)) s.group = groups[0];
  const cats = tr ? [] : (s.scope === "pro" && s.type === "in" ? proCats() : CATS[s.scope][s.type][s.group]);
  const catOpts = tr ? [] : (cats.includes(s.cat) ? cats : [s.cat, ...cats]);
  const d = ro ? "disabled" : "";
  const showStore = !tr && s.type === "out" && s.scope === "foyer";
  const showItems = showStore && (s.cat === "Courses" || sheetItems.length || s.receipt_path || sheetFile);
  const accOpts = sel => `<option value="">Aucun compte</option>` + [...ACC].sort((a, b) => (a.ord || 0) - (b.ord || 0)).map(a => `<option value="${a.id}" ${sel === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("");
  const itemsTotal = sum(sheetItems, i => num(i.price) || 0);
  const knownStores = [...new Set([...TX.map(t => t.store).filter(Boolean), ...STORES])];
  const rec = s.rec_id ? REC.find(r => r.id === s.rec_id) : null;
  $("#sheetHost").innerHTML = `<div class="scrim" id="scrim"><form class="sheet" id="txForm" role="dialog" aria-label="${isNew ? "Nouvelle ligne" : "Ligne"}" novalidate>
    <div class="env-head"><h3>${isNew ? "Nouvelle ligne" : ro ? "Détail de la ligne" : "Modifier la ligne"}</h3><button type="button" class="btn" id="closeSheet">Fermer</button></div>
    ${ro ? `<div class="alert"><span class="dot"></span><div>${s.source === "coach" ? "Paiement importé depuis TB my Coach : modifie-le dans ton app de coaching." : "Les lignes de l'activité pro sont modifiables par " + esc(S.owner || "le titulaire") + " uniquement."}</div></div>` : ""}
    <div class="typesw three">
      <button type="button" class="out" data-sw="mode" data-val="out" aria-pressed="${s.mode === "out"}" ${d || (!isNew && tr ? "disabled" : "")}>Dépense</button>
      <button type="button" class="in" data-sw="mode" data-val="in" aria-pressed="${s.mode === "in"}" ${d || (!isNew && tr ? "disabled" : "")}>Revenu</button>
      <button type="button" class="tr" data-sw="mode" data-val="transfer" aria-pressed="${tr}" ${d || (!isNew && !tr ? "disabled" : "")}>Virement</button>
    </div>
    ${!tr && isOwner() && S.regime !== "salarie" ? `<div class="typesw"><button type="button" class="foy" data-sw="scope" data-val="foyer" aria-pressed="${s.scope === "foyer"}" ${d}>Foyer</button><button type="button" class="pr" data-sw="scope" data-val="pro" aria-pressed="${s.scope === "pro"}" ${d}>Activité pro</button></div>` : ""}
    <label class="f"><span>Montant (€)</span><input class="amtin" id="f_amount" type="text" inputmode="decimal" placeholder="0,00" value="${s.amount === "" ? "" : String(s.amount).replace(".", ",")}" ${d}></label>
    ${tr ? `<div class="fgrid">
        <label class="f"><span>Depuis</span><select id="f_from" ${d}>${accOpts(s.from)}</select></label>
        <label class="f"><span>Vers</span><select id="f_to" ${d}>${accOpts(s.to)}</select></label>
        <label class="f"><span>Date</span><input type="date" id="f_date" value="${s.date}" ${d}></label></div>
      <label class="f"><span>Libellé</span><input type="text" id="f_label" value="${esc(s.label === "Virement" ? "" : s.label)}" placeholder="ex. Épargne du mois, retrait espèces" ${d}></label>`
    : `<div class="fgrid">
      ${groups.length > 1 ? `<label class="f"><span>Enveloppe</span><select id="f_group" ${d}>${groups.map(g => `<option value="${g}" ${s.group === g ? "selected" : ""}>${g === "dieu" ? esc(dieuLabel()) : GROUP_LABEL[g]}</option>`).join("")}</select></label>` : ""}
      <label class="f"><span>${s.scope === "pro" && s.type === "in" ? "Prestation" : "Catégorie"}</span><select id="f_cat" ${d}>${catOpts.map(c => `<option ${s.cat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
      <label class="f"><span>Date</span><input type="date" id="f_date" value="${s.date}" ${d}></label>
    </div>
    <label class="f"><span>Libellé</span><input type="text" id="f_label" value="${esc(s.label)}" placeholder="${s.scope === "pro" ? "ex. Séance du mardi" : "ex. Courses de la semaine, loyer"}" ${d}></label>
    ${showStore ? `<label class="f"><span>Magasin ou commerce</span><input type="text" id="f_store" list="storeList" value="${esc(s.store || "")}" placeholder="ex. Lidl, Carrefour, marché" ${d}></label><datalist id="storeList">${knownStores.map(x => `<option value="${esc(x)}">`).join("")}</datalist>` : ""}
    ${s.scope === "pro" && s.type === "in" ? `<label class="f"><span>Client(s)</span><input type="text" id="f_client" list="clientList" value="${esc(s.client || "")}" placeholder="Sépare plusieurs clients par ;" ${d}></label><datalist id="clientList">${knownClients().map(c => `<option value="${esc(c)}">`).join("")}</datalist>` : ""}
    <div class="fgrid">
      <label class="f"><span>Compte</span><select id="f_account" ${d}>${accOpts(s.account_id)}</select></label>
      <label class="f"><span>Moyen de paiement</span><select id="f_method" ${d}>${["", "Carte", "Virement", "Prélèvement", "Espèces", "Chèque", "Stripe"].concat(["", "Carte", "Virement", "Prélèvement", "Espèces", "Chèque", "Stripe"].includes(s.method || "") ? [] : [s.method]).map(m => `<option value="${esc(m)}" ${(s.method || "") === m ? "selected" : ""}>${esc(m) || "Non précisé"}</option>`).join("")}</select></label>
      ${s.type === "in" ? `<label class="f"><span>Statut</span><select id="f_status" ${d}><option value="paid" ${s.status !== "pending" ? "selected" : ""}>Encaissé</option><option value="pending" ${s.status === "pending" ? "selected" : ""}>En attente</option></select></label>` : ""}
    </div>
    ${isNew ? `<div class="f"><span class="small muted" style="font-weight:500">Fréquence</span><div class="seg"><button type="button" data-freq="once" aria-pressed="${s.freq !== "month"}">Ponctuelle</button><button type="button" data-freq="month" aria-pressed="${s.freq === "month"}">Chaque mois</button></div>
      ${s.freq === "month" ? `<div class="fgrid" style="margin-top:8px;align-items:end"><label class="f"><span>Jour du mois</span><select id="f_day">${dayOptions(s.recDay || +s.date.slice(8))}</select></label>
        <label class="f"><span>Se termine</span><select id="f_endmode"><option value="none" ${!s.endMode || s.endMode === "none" ? "selected" : ""}>Jamais</option><option value="count" ${s.endMode === "count" ? "selected" : ""}>Après un nombre de fois</option><option value="date" ${s.endMode === "date" ? "selected" : ""}>À une date</option></select></label>
        ${s.endMode === "count" ? `<label class="f"><span>Nombre de fois</span><input type="number" id="f_endcount" min="1" max="60" inputmode="numeric" value="${s.endCount || ""}" placeholder="ex. 3"></label>` : ""}
        ${s.endMode === "date" ? `<label class="f"><span>Dernier mois</span><input type="month" id="f_endmonth" min="${s.date.slice(0, 7)}" value="${s.endMonth || ""}"></label>` : ""}</div>
      <p class="note" style="margin:6px 0 0">Ajoutée automatiquement le ${dayLabel(s.recDay || +s.date.slice(8))} de chaque mois, à partir du ${new Date(s.date + "T12:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}${sheetEndKey(s) ? `, jusqu'en ${monthLabel(sheetEndKey(s))} inclus` : ", jusqu'à ce que tu l'arrêtes"}.</p>` : ""}</div>`
    : rec ? `<div class="alert"><span class="dot"></span><div>Ligne récurrente : le ${dayLabel(rec.day)} de chaque mois${rec.end_month ? `, jusqu'en ${monthLabel(rec.end_month)}` : ""}${rec.active ? "" : " (arrêtée)"}. ${!ro && rec.active ? `<button type="button" class="btn sm" id="stopRec">Arrêter la récurrence</button>` : ""}<br><span class="note">Modifier ce montant ne change que ce mois. ${!ro && rec.active ? `<button type="button" class="linkbtn" id="applyRec">Appliquer aussi aux prochains mois</button>` : ""}</span></div></div>` : ""}
    ${showStore ? `<div class="receipt">
      <div class="env-head"><b>Ticket de caisse</b>${s.receipt_path ? `<button type="button" class="linkbtn small" id="seeReceipt">Voir le ticket</button>` : ""}</div>
      ${sheetPrevUrl ? `<img src="${sheetPrevUrl}" alt="Aperçu du ticket" class="rcpt-prev">` : ""}
      ${ro ? "" : `<label class="btn file"><input type="file" id="f_receipt" accept="image/*" hidden>${sheetFile || s.receipt_path ? "Changer la photo" : "Photographier ou choisir le ticket"}</label>`}
      ${sheetFile && !ro ? `<button type="button" class="btn primary" id="readReceipt">Lire les articles du ticket</button><div class="small muted" id="ocrState"></div>` : ""}
    </div>` : ""}
    ${showItems ? `<div class="items">
      <div class="env-head"><b>Articles</b><span class="small ${sheetItems.length && Math.abs(itemsTotal - (num(s.amount) || 0)) > 0.05 ? "neg" : "muted"}">${sheetItems.length ? `${sheetItems.length} article${sheetItems.length > 1 ? "s" : ""} · ${eur(itemsTotal)}` : "Aucun article"}</span></div>
      ${sheetItems.map((it, i) => `<div class="item">
        <input type="text" data-it="${i}" data-k="name" value="${esc(it.name)}" placeholder="Article" ${d}>
        <div class="item-r">
          <input type="text" inputmode="decimal" data-it="${i}" data-k="qty" value="${it.qty == null ? "" : String(it.qty).replace(".", ",")}" placeholder="Qté" ${d}>
          <select data-it="${i}" data-k="unit" ${d}>${[["kg", "kg"], ["l", "L"], ["u", "unité"]].map(([v, l]) => `<option value="${v}" ${it.unit === v ? "selected" : ""}>${l}</option>`).join("")}</select>
          <input type="text" inputmode="decimal" data-it="${i}" data-k="price" value="${it.price === "" || it.price == null ? "" : String(it.price).replace(".", ",")}" placeholder="Prix €" ${d}>
          ${ro ? "" : `<button type="button" class="btn sm danger" data-itdel="${i}" aria-label="Retirer l'article">×</button>`}
        </div>
        <select data-it="${i}" data-k="family" class="fam" ${d}>${FAMILIES.map(f => `<option ${it.family === f ? "selected" : ""}>${f}</option>`).join("")}</select>
      </div>`).join("")}
      ${ro ? "" : `<button type="button" class="linkbtn small" id="addItem">Ajouter un article</button>`}
      <p class="note" style="margin:4px 0 0">Indique le poids (kg) ou le volume (L) pour obtenir le prix au kilo. Pour les produits à l'unité, laisse « unité ».</p>
    </div>` : ""}`}
    ${!isNew && memberName(s.created_by) ? `<p class="note" style="margin:0">Saisi par ${esc(memberName(s.created_by))}</p>` : ""}
    <div class="small err" id="sheetMsg" role="alert"></div>
    ${confirmDel ? (s.rec_id && !tr ? `<div class="confirm" style="display:grid;gap:8px">Cette ligne revient chaque mois. Que veux-tu supprimer ?
        <button type="button" class="btn danger" id="delYes">Seulement celle du ${new Date(s.date + "T12:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</button>
        <button type="button" class="btn danger" id="delAfter">Celle-ci et toutes les suivantes</button>
        <button type="button" class="btn" id="delNo">Ne rien supprimer</button></div>`
      : `<div class="confirm">Supprimer définitivement cette ligne${tr ? " (et sa contrepartie)" : ""} ? <button type="button" class="btn danger" id="delYes">Supprimer</button><button type="button" class="btn" id="delNo">Garder</button></div>`) : ""}
    ${ro ? "" : `<div class="sheet-actions">${!isNew && !confirmDel ? `<button type="button" class="btn danger" id="delTx">Supprimer</button>` : "<span></span>"}<button type="submit" class="btn primary" id="saveTx">${isNew ? "Enregistrer" : "Mettre à jour"}</button></div>`}
  </form></div>`;
  bindSheet(isNew, ro);
}
function pullSheet() {
  const s = sheet; const v = id => { const e = $("#" + id); return e ? e.value : undefined; };
  if (v("f_amount") !== undefined) s.amount = v("f_amount");
  if (v("f_date") !== undefined) s.date = v("f_date");
  if (v("f_label") !== undefined) s.label = v("f_label");
  if (v("f_cat") !== undefined) s.cat = v("f_cat");
  if (v("f_group") !== undefined) s.group = v("f_group");
  if (v("f_client") !== undefined) s.client = v("f_client");
  if (v("f_store") !== undefined) s.store = v("f_store");
  if (v("f_account") !== undefined) s.account_id = v("f_account");
  if (v("f_method") !== undefined) s.method = v("f_method");
  if (v("f_status") !== undefined) s.status = v("f_status");
  if (v("f_from") !== undefined) s.from = v("f_from");
  if (v("f_to") !== undefined) s.to = v("f_to");
  if (v("f_endcount") !== undefined) s.endCount = v("f_endcount");
  if (v("f_endmonth") !== undefined) s.endMonth = v("f_endmonth");
  document.querySelectorAll("[data-it]").forEach(e => { const it = sheetItems[+e.dataset.it]; if (it) it[e.dataset.k] = e.value; });
}
function bindSheet(isNew, ro) {
  const f = $("#txForm"), s = sheet; const say = m => { $("#sheetMsg").textContent = m; };
  f.querySelectorAll("[data-sw]").forEach(b => b.onclick = () => { pullSheet(); s[b.dataset.sw] = b.dataset.val; if (b.dataset.sw === "mode" && b.dataset.val !== "transfer") { s.type = b.dataset.val; s.group = b.dataset.val === "in" ? (s.scope === "pro" ? "ca" : "revenu") : (s.scope === "pro" ? "charge" : "variable"); s.cat = ""; } if (b.dataset.sw === "scope") { s.group = s.type === "in" ? (s.scope === "pro" ? "ca" : "revenu") : (s.scope === "pro" ? "charge" : "variable"); s.cat = ""; } drawSheet(isNew); });
  f.querySelectorAll("[data-freq]").forEach(b => b.onclick = () => { pullSheet(); s.freq = b.dataset.freq; drawSheet(isNew); });
  const fd = $("#f_day"); if (fd) fd.onchange = () => { pullSheet(); s.recDay = +fd.value; s.date = dateWithDay(s.date, s.recDay); drawSheet(isNew); };
  const fem = $("#f_endmode"); if (fem) fem.onchange = () => { pullSheet(); s.endMode = fem.value; drawSheet(isNew); };
  const later = fn => setTimeout(() => { if (sheet === s && document.getElementById("txForm")) fn(); }, 0);
  const fec = $("#f_endcount"); if (fec) fec.onchange = () => { pullSheet(); later(() => drawSheet(isNew)); };
  const femo = $("#f_endmonth"); if (femo) femo.onchange = () => { pullSheet(); later(() => drawSheet(isNew)); };
  const fdt = $("#f_date"); if (fdt && s.freq === "month" && isNew) fdt.onchange = () => { pullSheet(); s.recDay = undefined; later(() => drawSheet(isNew)); };
  const g = $("#f_group"); if (g) g.onchange = () => { pullSheet(); s.cat = ""; drawSheet(isNew); };
  const c = $("#f_cat"); if (c) c.onchange = () => { pullSheet(); drawSheet(isNew); };
  $("#closeSheet").onclick = closeSheet;
  $("#scrim").onclick = e => { if (e.target.id === "scrim") closeSheet(); };
  const rf = $("#f_receipt"); if (rf) rf.onchange = () => { pullSheet(); const file = rf.files && rf.files[0]; if (!file) return; sheetFile = file; if (sheetPrevUrl) URL.revokeObjectURL(sheetPrevUrl); sheetPrevUrl = URL.createObjectURL(file); if (!s.cat || s.group !== "variable") { s.group = "variable"; } if (s.cat !== "Courses" && !s.label) s.cat = "Courses"; drawSheet(isNew); };
  const rr = $("#readReceipt"); if (rr) rr.onclick = () => readReceipt(isNew);
  const sr = $("#seeReceipt"); if (sr) sr.onclick = async () => { const { data, error } = await sb.storage.from("cpta-receipts").createSignedUrl(s.receipt_path, 600); if (error) { say("Impossible d'ouvrir le ticket."); return; } window.open(data.signedUrl, "_blank", "noopener"); };
  const ai = $("#addItem"); if (ai) ai.onclick = () => { pullSheet(); sheetItems.push({ name: "", qty: "", unit: "u", price: "", family: "Épicerie" }); drawSheet(isNew); setTimeout(() => { const n = document.querySelector(`[data-it="${sheetItems.length - 1}"][data-k="name"]`); if (n) n.focus(); }, 30); };
  f.querySelectorAll("[data-itdel]").forEach(b => b.onclick = () => { pullSheet(); sheetItems.splice(+b.dataset.itdel, 1); drawSheet(isNew); });
  f.querySelectorAll('[data-k="name"]').forEach(e => e.onchange = () => { const it = sheetItems[+e.dataset.it]; if (it && (!it.family || it.family === "Épicerie")) { it.name = e.value; it.family = guessFamily(e.value); const sel = document.querySelector(`[data-it="${e.dataset.it}"][data-k="family"]`); if (sel) sel.value = it.family; } });
  const st = $("#stopRec"); if (st) st.onclick = async () => { const { error } = await sb.from("cpta_recurring").update({ active: false, end_month: s.date.slice(0, 7) + "-01" }).eq("id", s.rec_id); if (error) { say(errMsg(error)); return; } toast("Récurrence arrêtée : plus d'ajout à partir du mois prochain"); closeSheet(); refresh(); };
  const ap = $("#applyRec"); if (ap) ap.onclick = async () => { pullSheet(); const a = num(s.amount); if (!a) { say("Indique un montant."); return; } const { error } = await sb.from("cpta_recurring").update({ amount: Math.abs(a), label: (s.label || "").trim() || s.cat, cat: s.cat, grp: s.group, account_id: s.account_id || null, store: s.store || "", method: s.method || "", client: s.scope === "pro" ? (s.client || "") : "", day: +s.date.slice(8) }).eq("id", s.rec_id); if (error) { say(errMsg(error)); return; } toast("Les prochains mois utiliseront ces valeurs"); };
  const dt = $("#delTx"); if (dt) dt.onclick = () => { pullSheet(); drawSheet(false, true); };
  const dn = $("#delNo"); if (dn) dn.onclick = () => drawSheet(false);
  const dy = $("#delYes"); if (dy) dy.onclick = () => deleteTx(s);
  const da = $("#delAfter"); if (da) da.onclick = () => deleteFrom(s);
  f.onsubmit = async e => { e.preventDefault(); if (ro) return; pullSheet(); await saveSheet(isNew, say); };
  if (isNew) setTimeout(() => { const a = $("#f_amount"); if (a && !a.value) a.focus(); }, 60);
}
/* supprime cette occurrence et toutes les suivantes, et termine la récurrence au mois précédent */
async function deleteFrom(s) {
  const r = REC.find(x => x.id === s.rec_id);
  const later = TX.filter(t => t.rec_id === s.rec_id && t.date >= s.date);
  const { error } = await sb.from("cpta_tx").delete().eq("rec_id", s.rec_id).gte("date", s.date).eq("foyer_id", FOYER);
  if (error) { toast(errMsg(error)); return; }
  later.forEach(t => { if (t.receipt_path) sb.storage.from("cpta-receipts").remove([t.receipt_path]).catch(() => {}); });
  if (r) {
    const endK = addMonths(s.date, -1);
    const stopped = endK < r.start_month.slice(0, 7);
    await sb.from("cpta_recurring").update(stopped ? { active: false, end_month: r.start_month } : { end_month: endK + "-01" }).eq("id", r.id);
  }
  toast(later.length > 1 ? `${later.length} lignes supprimées, récurrence arrêtée` : "Ligne supprimée, récurrence arrêtée"); closeSheet(); refresh();
}
async function deleteTx(s) {
  if (s.transfer_id) { const { error } = await sb.from("cpta_tx").delete().eq("transfer_id", s.transfer_id).eq("foyer_id", FOYER); if (error) { toast(errMsg(error)); return; } }
  else {
    if (s.rec_id) { const r = REC.find(x => x.id === s.rec_id); if (r) await sb.from("cpta_recurring").update({ skip: [...new Set([...(r.skip || []), s.date])] }).eq("id", r.id); }
    const { error } = await sb.from("cpta_tx").delete().eq("id", s.id); if (error) { toast(errMsg(error)); return; }
    if (s.receipt_path) sb.storage.from("cpta-receipts").remove([s.receipt_path]).catch(() => {});
  }
  toast("Ligne supprimée"); closeSheet(); refresh();
}
async function saveSheet(isNew, say) {
  const s = sheet; const amt = num(s.amount);
  if (amt == null || amt === 0) { say("Indique un montant."); return; }
  if (!s.date) { say("Indique une date."); return; }
  const btn = $("#saveTx"); btn.disabled = true; btn.textContent = "Enregistrement…";
  const fail = m => { say(m); btn.disabled = false; btn.textContent = isNew ? "Enregistrer" : "Mettre à jour"; };
  try {
    if (s.mode === "transfer") {
      if (!s.from || !s.to || s.from === s.to) return fail("Choisis deux comptes différents.");
      const label = (s.label || "").trim() || `${accName(s.from)} → ${accName(s.to)}`;
      const base = { foyer_id: FOYER, date: s.date, scope: "foyer", grp: "transfert", cat: "Virement", label, amount: Math.abs(amt), status: "paid", method: "Virement", client: "", store: "" };
      if (isNew) {
        const tid = crypto.randomUUID();
        const { error } = await sb.from("cpta_tx").insert([{ ...base, type: "out", account_id: s.from, transfer_id: tid }, { ...base, type: "in", account_id: s.to, transfer_id: tid }]);
        if (error) return fail(errMsg(error));
      } else {
        const legs = TX.filter(t => t.transfer_id === s.transfer_id);
        for (const l of legs) { const { error } = await sb.from("cpta_tx").update({ date: s.date, label, amount: Math.abs(amt), account_id: l.type === "out" ? s.from : s.to }).eq("id", l.id); if (error) return fail(errMsg(error)); }
      }
      toast(isNew ? "Virement enregistré" : "Virement mis à jour"); closeSheet(); goMonth(s.date); refresh(); return;
    }
    const body = { date: s.date, type: s.type, scope: s.scope, grp: s.group, cat: s.cat, label: (s.label || "").trim() || s.cat, amount: Math.round(amt * 100) / 100, status: s.type === "in" ? (s.status || "paid") : "paid", method: s.method || "", client: s.scope === "pro" && s.type === "in" ? (s.client || "").trim() : "", store: s.type === "out" && s.scope === "foyer" ? (s.store || "").trim() : "", account_id: s.account_id || null };
    let id = s.id;
    if (isNew) {
      if (s.freq === "month" && ((s.endMode === "date" && !sheetEndKey(s)) || (s.endMode === "count" && !(+s.endCount >= 1)))) return fail(s.endMode === "date" ? "Choisis le dernier mois de la récurrence." : "Indique combien de fois.");
      if (s.freq === "month") {
        const { data: r, error: re } = await sb.from("cpta_recurring").insert({ foyer_id: FOYER, type: body.type, scope: body.scope, grp: body.grp, cat: body.cat, label: body.label, amount: Math.abs(body.amount), day: s.recDay || +s.date.slice(8), account_id: body.account_id, store: body.store, method: body.method, client: body.client, start_month: s.date.slice(0, 7) + "-01", end_month: sheetEndKey(s) ? sheetEndKey(s) + "-01" : null }).select("id").single();
        if (s.endMode === "date" && !sheetEndKey(s)) return fail("Choisis le dernier mois de la récurrence.");
        if (s.endMode === "count" && !(+s.endCount >= 1)) return fail("Indique combien de fois.");
        if (re) return fail(errMsg(re)); body.rec_id = r.id;
      }
      const { data, error } = await sb.from("cpta_tx").insert({ ...body, foyer_id: FOYER }).select("id").single();
      if (error) return fail(errMsg(error)); id = data.id;
    } else {
      const { error } = await sb.from("cpta_tx").update(body).eq("id", id); if (error) return fail(errMsg(error));
    }
    if (body.account_id) { try { localStorage.setItem("compta.acc." + FOYER, body.account_id); } catch (e) {} }
    if (sheetFile) {
      btn.textContent = "Envoi du ticket…";
      const blob = await compressImage(sheetFile);
      const path = `${FOYER}/${id}.jpg`;
      const { error: ue } = await sb.storage.from("cpta-receipts").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (ue) toast("Ligne enregistrée, mais le ticket n'a pas pu être envoyé");
      else await sb.from("cpta_tx").update({ receipt_path: path }).eq("id", id);
    }
    const items = sheetItems.map(i => ({ name: (i.name || "").trim(), qty: num(i.qty), unit: i.unit || "u", price: num(i.price), family: i.family || guessFamily(i.name) })).filter(i => i.name && i.price != null);
    const hadItems = ITEMS.some(i => i.tx_id === id);
    if (hadItems || items.length) {
      if (hadItems) await sb.from("cpta_items").delete().eq("tx_id", id);
      if (items.length) { const { error: ie } = await sb.from("cpta_items").insert(items.map(i => ({ ...i, foyer_id: FOYER, tx_id: id }))); if (ie) toast("Ligne enregistrée, mais pas les articles"); }
    }
    toast(isNew ? (s.freq === "month" ? "Ligne récurrente enregistrée" : "Ligne enregistrée") : "Ligne mise à jour");
    closeSheet(); goMonth(s.date); refresh();
  } catch (err) { fail("Pas de connexion internet, réessaie."); }
}
function goMonth(ds) { const [y, m] = ds.split("-").map(Number); cur = { y, m }; }
function closeSheet() { $("#sheetHost").innerHTML = ""; sheet = null; sheetFile = null; sheetItems = []; if (sheetPrevUrl) { URL.revokeObjectURL(sheetPrevUrl); sheetPrevUrl = null; } }

/* ===================== Ticket : compression, lecture, analyse ===================== */
function loadImage(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = rej; im.src = u; }); }
async function compressImage(file, max = 1600, q = 0.72) {
  const im = await loadImage(file); const r = Math.min(1, max / Math.max(im.width, im.height));
  const c = document.createElement("canvas"); c.width = Math.round(im.width * r); c.height = Math.round(im.height * r);
  c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
  return await new Promise(res => c.toBlob(res, "image/jpeg", q));
}
async function prepForOcr(file) {
  const im = await loadImage(file); const target = 1800; const r = Math.min(2, target / Math.max(im.width, im.height));
  const c = document.createElement("canvas"); c.width = Math.round(im.width * r); c.height = Math.round(im.height * r);
  const x = c.getContext("2d"); x.drawImage(im, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) { let g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; g = g > 170 ? 255 : g < 90 ? 0 : (g - 90) * 255 / 80; p[i] = p[i + 1] = p[i + 2] = g; }
  x.putImageData(d, 0, 0);
  return await new Promise(res => c.toBlob(res, "image/png"));
}
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
async function readReceipt(isNew) {
  pullSheet(); const st = $("#ocrState"), btn = $("#readReceipt");
  btn.disabled = true; st.textContent = "Préparation de la photo…";
  try {
    if (!window.Tesseract) { st.textContent = "Chargement du lecteur (la première fois seulement)…"; await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js"); }
    const img = await prepForOcr(sheetFile);
    const worker = await Tesseract.createWorker("fra", 1, { logger: m => { if (m.status === "recognizing text") st.textContent = `Lecture du ticket… ${Math.round(m.progress * 100)} %`; } });
    const { data } = await worker.recognize(img); await worker.terminate();
    const r = parseReceipt(data.text || "");
    if (!r.items.length) { st.textContent = "Je n'ai pas réussi à lire les articles. Ajoute-les à la main, ou reprends la photo à plat et bien éclairée."; btn.disabled = false; return; }
    sheetItems = r.items;
    if (r.store && !sheet.store) sheet.store = r.store;
    if (r.total && !num(sheet.amount)) sheet.amount = r.total;
    if (r.date && isNew) sheet.date = r.date;
    sheet.cat = "Courses"; sheet.group = "variable"; if (!sheet.label) sheet.label = "Courses";
    drawSheet(isNew);
    const m = $("#sheetMsg"); m.className = "small muted"; m.textContent = `${r.items.length} articles lus. Vérifie les noms, poids et prix avant d'enregistrer.`;
  } catch (e) { st.textContent = "La lecture a échoué (connexion ?). Tu peux saisir les articles à la main."; btn.disabled = false; }
}
function parseReceipt(text) {
  const lines = text.split(/\n/).map(l => l.replace(/[|_]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const money = s => num(s.replace(/[oO]/g, "0"));
  let store = ""; const head = lines.slice(0, 8).join(" ").toLowerCase();
  for (const s of STORES) if (head.includes(s.toLowerCase()) && s.length > store.length) store = s;
  let date = ""; for (const l of lines) { const m = l.match(/\b(\d{2})[\/.\-](\d{2})[\/.\-](\d{2,4})\b/); if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; if (+m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31 && +y >= 2020) { date = `${y}-${m[2]}-${m[1]}`; break; } } }
  let total = null; for (const l of lines) { if (/total|a payer|à payer/i.test(l) && !/sous/i.test(l)) { const m = l.match(/(\d+[.,]\d{2})\s*(€|eur)?\s*$/i); if (m) { total = money(m[1]); break; } } }
  const stop = /total|sous.?total|tva|carte|\bcb\b|visa|mastercard|esp[eè]ces|rendu|monnaie|montant|paiement|ticket|caisse|merci|siret|\btel\b|t[ée]l[ée]phone|www\.|avoir|fid[ée]lit|points?\b|nb art|articles|solde|cagnotte|\bht\b|\bttc\b|transaction|autoris|\bn[°o]\s|heure|magasin|bienvenue/i;
  const items = []; let pendingName = null, pendingQty = null, prevWasItem = false;
  const sizeOf = name => { const nm = name.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gr|l|cl|ml)\b/i); if (!nm) return null; const v = num(nm[1]), u = nm[2].toLowerCase();
    return u === "kg" ? { qty: v, unit: "kg" } : (u === "g" || u === "gr") ? { qty: v / 1000, unit: "kg" } : u === "l" ? { qty: v, unit: "l" } : u === "cl" ? { qty: v / 100, unit: "l" } : { qty: v / 1000, unit: "l" }; };
  const clean = n => { n = n.replace(/\s+\d{1,2}$/, "").replace(/^[\d\s.,*]+/, "").trim(); return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase(); };
  const push = (name, price, q) => { const sz = q || sizeOf(name); items.push({ name: clean(name), qty: sz ? Math.round(sz.qty * 1000) / 1000 : null, unit: sz ? sz.unit : "u", price, family: guessFamily(name) }); };
  for (const l of lines) {
    if (/^\d{1,2}[\/.\-]\d{2}[\/.\-]\d{2,4}/.test(l)) { prevWasItem = false; continue; }
    const wm = l.match(/(\d+[.,]\d{1,3})\s*kg\s*[x×*]\s*(\d+[.,]\d{2})/i);
    if (wm) { const q = { qty: num(wm[1]), unit: "kg" }; const lp = l.match(/(\d+[.,]\d{2})\s*(?:€|eur)?\s*[A-D]?\s*$/i); const lineTotal = lp && lp.index > wm.index + wm[0].length ? money(lp[1]) : null;
      if (pendingName) { if (lineTotal != null) { push(pendingName, lineTotal, q); pendingName = null; } else pendingQty = q; }
      else if (prevWasItem && items.length) { items[items.length - 1].qty = q.qty; items[items.length - 1].unit = "kg"; }
      continue; }
    const um = l.match(/^(\d{1,2})\s*[x×*]\s*(\d+[.,]\d{2})/);
    if (um) { if (prevWasItem && items.length) { const it = items[items.length - 1]; if (it.qty != null) it.qty = Math.round(it.qty * (+um[1]) * 1000) / 1000; } continue; }
    if (stop.test(l)) { pendingName = null; pendingQty = null; prevWasItem = false; continue; }
    const po = l.match(/^(-?\d{1,3}[.,]\d{2})\s*(?:€|eur)?\s*[A-D]?$/i);
    if (po) { if (pendingName) { push(pendingName, money(po[1]), pendingQty); pendingName = null; pendingQty = null; prevWasItem = true; } continue; }
    const m = l.match(/^(.*?[A-Za-zÀ-ÿ].*?)\s+(-?\d{1,3}[.,]\d{2})\s*(?:€|eur|[A-D])?\s*$/i);
    if (m) { const price = money(m[2]); if (price != null && Math.abs(price) <= 500 && m[1].replace(/[^A-Za-zÀ-ÿ]/g, "").length >= 2) { push(m[1], price, pendingQty); pendingName = null; pendingQty = null; prevWasItem = true; continue; } }
    if (/[A-Za-zÀ-ÿ]{3,}/.test(l) && l.length < 40) { pendingName = l.replace(/\s+\d+[.,]\d{1,3}\s*kg\s*$/i, ""); pendingQty = sizeOf(l); prevWasItem = false; }
  }
  return { store, date, total, items: items.filter(i => i.price) };
}

/* ===================== Liaisons des vues ajoutées ===================== */
function bindExtra() {
  document.querySelectorAll("[data-add]").forEach(b => b.onclick = () => { const g = b.dataset.add; const p = g === "revenu" ? { mode: "in", type: "in", group: "revenu", cat: "Salaire" } : { mode: "out", type: "out", group: g, cat: "" }; openSheet(null, p); });
  document.querySelectorAll("[data-plan]").forEach(b => b.onclick = () => { const r = REC.find(x => x.id === b.dataset.plan); if (r) toast(`Prévu automatiquement le ${r.day} : ${r.label}, ${eur(r.amount)}`); });
  document.querySelectorAll("[data-goacc]").forEach(b => b.onclick = () => { window._accOpen = b.dataset.goacc; setView("comptes"); });
  document.querySelectorAll("[data-accopen]").forEach(b => b.onclick = () => { window._accOpen = window._accOpen === b.dataset.accopen ? null : b.dataset.accopen; render(); });
  document.querySelectorAll("[data-accf]").forEach(inp => { const h = () => debounce("accf" + inp.dataset.id + inp.dataset.accf, async () => { const { error } = await sb.from("cpta_accounts").update({ [inp.dataset.accf]: inp.value }).eq("id", inp.dataset.id); if (error) toast(errMsg(error)); else { const a = ACC.find(x => x.id === inp.dataset.id); if (a) a[inp.dataset.accf] = inp.value; toast("Compte mis à jour"); } }, 700); inp.oninput = h; inp.onchange = h; });
  document.querySelectorAll("[data-adjust]").forEach(b => b.onclick = async () => { const a = ACC.find(x => x.id === b.dataset.adjust); const v = num($("#adj-" + a.id).value); if (v == null) { toast("Indique le solde affiché par ta banque"); return; } const mv = accountBalance(a) - a.balance; const { error } = await sb.from("cpta_accounts").update({ balance: Math.round((v - mv) * 100) / 100 }).eq("id", a.id); if (error) toast(errMsg(error)); else { toast("Solde ajusté"); refresh(); } });
  const tr = $("#doTransfer"); if (tr) tr.onclick = () => openSheet(null, { mode: "transfer", label: "" });
  const aa = $("#addAcc2"); if (aa) aa.onclick = async () => { const { data, error } = await sb.from("cpta_accounts").insert({ foyer_id: FOYER, name: "Nouveau compte", kind: "courant", balance: 0, ord: ACC.length + 1, opening_date: todayIso() }).select("id").single(); if (error) toast(errMsg(error)); else { window._accOpen = data.id; refresh(); } };
  const pq = $("#prodq"); if (pq) pq.oninput = () => { window._prodq = pq.value; $("#prodres").innerHTML = prodHistory(pq.value); };
  document.querySelectorAll("[data-rec]").forEach(e => { const h = () => debounce("rec" + e.dataset.rec + e.dataset.rk, async () => {
      let v = e.value; if (e.dataset.rk === "day") v = +v; if (e.dataset.rk === "amount") { v = num(v); if (!v) { toast("Indique un montant"); return; } v = Math.abs(v); } if (e.dataset.rk === "account_id") v = v || null; if (e.dataset.rk === "end_month") v = v ? v + "-01" : null;
      const { error } = await sb.from("cpta_recurring").update({ [e.dataset.rk]: v }).eq("id", e.dataset.rec);
      if (error) toast(errMsg(error)); else { const r = REC.find(x => x.id === e.dataset.rec); if (r) r[e.dataset.rk] = v; toast(e.dataset.rk === "day" ? `Désormais le ${dayLabel(v)} de chaque mois` : e.dataset.rk === "end_month" ? (v ? `Dernière échéance en ${monthLabel(v)}` : "Récurrence sans fin") : "Récurrence mise à jour"); if (e.dataset.rk === "end_month") render(); }
    }, e.tagName === "SELECT" ? 0 : 800); e.onchange = h; if (e.tagName !== "SELECT") e.oninput = h; });
  document.querySelectorAll("[data-recstop]").forEach(b => b.onclick = async () => { if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmer l'arrêt"; return; }
    const k = todayIso().slice(0, 7) + "-01"; const { error } = await sb.from("cpta_recurring").update({ active: false, end_month: k }).eq("id", b.dataset.recstop); if (error) toast(errMsg(error)); else { toast("Récurrence arrêtée"); refresh(); } });
  const pe = $("#s_persons"); if (pe) pe.oninput = () => debounce("persons", () => saveSettings({ persons: +pe.value || 0 }), 700);
}
