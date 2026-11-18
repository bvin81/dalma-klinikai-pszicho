# Jánosi Dalma – klinikai pszichológusi változat (bemutató)

A v3 weboldal (`bvin81/dalma-pszichoterapia-site-v3-refactored-v2`) **párhuzamos** változata arra az esetre,
ha a terápiás tevékenység szünetel, és a hangsúly a klinikai pszichológiai vizsgálatokra kerül.
Célja, hogy a két változat egymás mellett bemutatható legyen.

## Eltérések a v3-hoz képest

| Terület | Változás |
|---|---|
| Főoldal | Új szöveg (klinikai profil), új szlogen, „Klinikai szolgáltatások” könyv, teszt-ajánló, szünetelő terápiák listája |
| Szolgáltatások | Új: `service/clinical-adult.html`, `clinical-child.html`, `autism-assessment.html`; a Sindelar megmaradt |
| Terápiás oldalak | Megmaradtak, a cím alatt „jelenleg szünetel” jelzéssel (`service_paused_badge`) |
| Navigáció | „Időszakos csoportok” helyett „Tesztek” |
| Tesztek | Új oldal: `tesztek.html` + `js/tests.js` + `data/tesztek/*.json` (WHO-5, GAD-7) |
| Blog | Változatlan |
| Adatkezelés | Új bekezdés az önértékelő tesztekről (hu/ro/en) |
| Indexelés | Minden oldalon `noindex`, `robots.txt` mindent tilt – **élesítéskor vissza kell állítani** |
| Stílus | Kiegészítés: `css/klinikai.css` |

## Önértékelő tesztek

- A pontozás **teljes egészében a böngészőben** történik; nincs tárolás (localStorage, cookie) és nincs hálózati küldés.
  Ezért egészségügyi adat (GDPR 9. cikk) kezelése nem történik.
- Új teszt: `data/tesztek/<id>.json` (a meglévők mintájára) + az azonosító az `index.json`-ba.
  Mezők: `kerdesek`, `valaszok`, `pontozas` (`szorzo`, `min`, `max`), `kategoriak` (`tol`, `ig`, `szint`: ok/enyhe/kozepes/magas),
  `kritikus_tetelek` (`[{ "id": 9, "kuszob": 1 }]` – ha a válasz eléri a küszöböt, azonnal megjelenik a krízisdoboz).
- A tételszövegek a `dalma-kerdoiv` repó `public/tesztek/` fájljaiból származnak (ugyanaz a forrás).

## Élesítés előtt tisztázandó (Dalma)

- [ ] **Klinikai szolgáltatások szövegei** – a `clin_*` kulcsok a `lang.json`-ban **tervezetek**; időtartam és díj most „Egyeztetés alapján”.
      A román és angol változat is ellenőrizendő.
- [ ] **GAD-7 és WHO-5 hivatalos magyar és román szövege** – amíg hiányzik, HU/RO nyelven az angol kérdések jelennek meg, figyelmeztetéssel.
      Saját fordítás nem használható (a küszöbértékek csak validált változatra érvényesek).
- [ ] **WHO-5 licenc** (CC BY-NC-SA 3.0 IGO, nem kereskedelmi): tisztázandó, hogy magánpraxis weboldalán ingyenes önteszt ennek megfelel-e.
- [ ] **WHO-5 ≤ 28 sáv** („nagyon alacsony jóllét”) a szakirodalomban használt depresszió-szűrő határ; Dalma hagyja jóvá a szövegezést.
- [ ] **Krízis-elérhetőségek** (`tests_help_body`): 112; TelVerde Antisuicid 0800 801 200 (a nyitvatartásra a források ellentmondanak, ezért nincs feltüntetve);
      116-123 csak Magyarországról hívható. Erdélyi magyar nyelvű vonal felvétele megfontolandó.
- [ ] **Autizmus-felmérő kérdőívek** (AQ, EQ, RAADS-R, CAT-Q, CATI) szándékosan **nincsenek** a nyilvános tesztek között:
      licencük online nyilvános közzétételre nem tisztázott (lásd `dalma-kerdoiv` README). Klinikusi felvételre a `form.janosidalma.ro` való.
- [ ] PHQ-9 csak akkor kerüljön ki, ha a 9. (önsértésre vonatkozó) tételre adott válasz kezelése szakmailag jóvá van hagyva (`kritikus_tetelek`).
- [ ] Cloudflare Web Analytics a tesztoldalon: csak az oldal címét látja, a válaszokat nem (azok nem kerülnek URL-be).

## Bemutatás / tárhely

Javasolt: külön Cloudflare Pages projekt ebből a repóból (build parancs nincs, output: `site`) → `<projekt>.pages.dev` cím.
Helyi futtatás: `npm run serve` → http://localhost:8000
