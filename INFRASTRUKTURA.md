> **FIGYELEM:** ez a fájl az élő v3 oldal (`dalma-pszichoterapia-site-v3-refactored-v2`) infrastruktúráját írja le.
> A klinikai bemutató változat (`dalma-klinikai-pszicho`) jelenleg nincs a janosidalma.ro-hoz kötve – lásd README.md.

# Infrastruktúra – janosidalma.ro

> Ebben a fájlban **nincs és nem is lehet** jelszó, API-kulcs vagy hozzáférési token.
> Azok jelszókezelőben vannak. A fájl a repó gyökerében van, a `site/` mappán
> kívül, ezért a weboldalon nem jelenik meg.

## Áttekintés

```
látogató ─► janosidalma.ro (DNS: Cloudflare) ─► Cloudflare Pages (projekt: janosidalma)
                                                  ▲
                         GitHub: main ág, site/ mappa ─┘  (push = automatikus deploy)
```

| Elem | Szolgáltató | Részletek |
|---|---|---|
| Domain | RoTLD (közvetlen regisztráció) | `janosidalma.ro`, regisztrálva: 2026-11-05 |
| Domain kezelése | rotld.ro → Domenii .ro → Administrare On-line | belépés: domain + jelszó; megerősítő e-mailek a **tulajdonosi címre** mennek (Dalma kezeli) |
| Nameserverek | Cloudflare | `carrera.ns.cloudflare.com`, `hal.ns.cloudflare.com` |
| DNS, HTTPS, CDN | Cloudflare (Free) | fiók: Vince; zóna: `janosidalma.ro` |
| Tárhely | Cloudflare Pages | projekt: `janosidalma`, production ág: `main`, build parancs: nincs, output: `site` |
| Forráskód | GitHub | `bvin81/dalma-pszichoterapia-site-v3-refactored-v2` |
| Kapcsolati űrlap | Formspree | végpont a `site/js/main.js`-ben (`FORMSPREE_ENDPOINT`) |

## Címek

| Cím | Viselkedés |
|---|---|
| `https://janosidalma.ro` | éles oldal |
| `https://www.janosidalma.ro` | 301 → `https://janosidalma.ro` (Cloudflare Redirect Rule: „Redirect from WWW to root”) |
| `http://…` | 301 → `https://…` |
| `https://janosidalma.pages.dev` | Pages háttércím; ugyanazt szolgálja ki, a canonical tagek miatt nem duplikált tartalom |
| `<ág>.janosidalma.pages.dev` | előnézet minden nem-`main` ágról (bemutatáshoz a megrendelőnek) |

## Cloudflare-beállítások

- AI-crawlerek: Search = Allow, Training = **Block**, Agents = Allow
- DNSSEC: kikapcsolva (bekapcsolható a Cloudflare-ben, majd a DS-rekordot a RoTLD-nél kell megadni)

## Teendők, határidők

- [ ] **Domain megújítása** – a lejárat a RoTLD WHOIS-ában ellenőrizendő; naptár-emlékeztető 1–2 hónappal előtte.
      Fizetés nélkül a domain `PendingDelete` állapotba kerül és 90 nap után törlődik.
- [ ] Formspree: csak a `janosidalma.ro` domainről fogadjon beküldést (ha a csomag engedi).

## Deploy

1. Változtatás a `site/` mappában → commit → `git push` a `main` ágra.
2. A Cloudflare Pages 1–2 percen belül élesíti (Workers & Pages → janosidalma → Deployments).
3. Kipróbáláshoz: külön ágra push → az ág előnézeti címe.

Helyi futtatás: `npm run serve` → http://localhost:8000

## Cloudflare nameserverek:

- `carrera.ns.cloudflare.com`
- `hal.ns.cloudflare.com`
