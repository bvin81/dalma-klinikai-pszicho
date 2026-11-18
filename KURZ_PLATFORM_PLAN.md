# Kurzusplatform Implementációs Terv
**Projekt:** Terapia_weboldal_v4 kiegészítése  
**Dátum:** 2026-06-09  
**Stack:** FastAPI + PostgreSQL (Railway) · React SPA (Vercel) · Stripe + Netopia · Vimeo

---

## Phase 0: Documentation Discovery — Eredmények

### Engedélyezett API-k és könyvtárak

| Könyvtár | Verzió | Forrás |
|---|---|---|
| `fastapi` | ^0.100.0 | https://fastapi.tiangolo.com |
| `pyjwt` | ^2.8.0 | https://pyjwt.readthedocs.io |
| `passlib[bcrypt]` | ^1.7.4 | passlib docs |
| `sqlmodel` | ^0.0.14 | https://sqlmodel.tiangolo.com |
| `psycopg2-binary` | ^2.9.0 | PyPI |
| `stripe` | latest | https://stripe.com/docs/api |
| `netopia-sdk` | latest | https://doc.netopia-payments.com/docs/payment-sdks/python/ |

### Kulcs API minták

**Stripe Checkout Session létrehozása:**
```python
session = stripe.checkout.Session.create(
    success_url="https://kurz.example.com/success",
    cancel_url="https://kurz.example.com/cancel",
    line_items=[{"price": "price_xxx", "quantity": 1}],
    mode="payment"
)
# Visszaad: session.url → erre irányítjuk a frontendről
```

**Stripe webhook ellenőrzés:**
```python
event = client.parse_event_notification(webhook_body, sig_header, webhook_secret)
if event.type == "checkout.session.completed":
    handle_checkout(event.data.object)
```

**FastAPI JWT session (max 2 egyidejű):**
```python
# JTI (JWT ID) alapú session nyilvántartás PostgreSQL-ben
# Login: ha >=2 session létezik → legrégebbit törli, újat hoz létre
jti = str(uuid.uuid4())
new_session = SessionRecord(user_id=user.id, token_jti=jti, expires_at=expire)
```

**Netopia IPN validálás:**
```python
payment_service.verify_ipn(request.data)  # JWT+RSA alapú ellenőrzés
```

**Vimeo domain-lock API:**
```
POST /videos/{video_id}/privacy/domains/{domain}
DELETE /videos/{video_id}/privacy/domains/{domain}
```
Követelmény: fizetős Vimeo csomag (Starter vagy felette)

---

## Phase 1: Projektstruktúra és Adatbázis

### Feladatok

1. **FastAPI projekt inicializálása**
```
kurz-api/
├── app/
│   ├── main.py
│   ├── models.py        # SQLModel táblák
│   ├── auth.py          # JWT, bcrypt
│   ├── routers/
│   │   ├── auth.py
│   │   ├── content.py
│   │   └── payments.py
│   ├── deps.py          # get_current_user dependency
│   └── config.py        # env változók
├── requirements.txt
└── railway.toml
```

2. **SQLModel adatmodellek** (`app/models.py`):
```python
class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    name: str
    preferred_lang: str = "hu"  # hu/ro/en
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserSession(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    token_jti: str = Field(unique=True, index=True)
    expires_at: datetime

class Block(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(unique=True, index=True)
    title_hu: str; title_ro: str; title_en: str
    description_hu: str; description_ro: str; description_en: str
    thumbnail_url: str
    price_ron: float
    stripe_price_id: str
    is_published: bool = False

class Lesson(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    block_id: int = Field(foreign_key="block.id", index=True)
    order_index: int
    title_hu: str; title_ro: str; title_en: str
    vimeo_id: str        # SOHA nem kerül a frontendre közvetlenül
    is_free: bool = False  # True: csak a bevezető videónál

class Purchase(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    block_id: int = Field(foreign_key="block.id", index=True)
    payment_provider: str  # "stripe" / "netopia"
    payment_id: str
    purchased_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime   # purchased_at + 6 hónap
```

3. **React SPA projekt inicializálása**
```bash
npm create vite@latest kurz-app -- --template react-ts
cd kurz-app && npm install
npm install react-router-dom axios
```

```
kurz-app/src/
├── pages/
│   ├── Catalog.tsx
│   ├── BlockDetail.tsx
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── Dashboard.tsx
│   └── LessonPlayer.tsx
├── components/
│   ├── BlockCard.tsx
│   ├── LessonList.tsx
│   └── ProtectedRoute.tsx
├── context/AuthContext.tsx
├── api/client.ts          # axios instance
└── styles/tokens.css      # design tokenek a főoldalról
```

### Ellenőrzési lista
- [ ] `uvicorn app.main:app` elindul hiba nélkül
- [ ] `alembic upgrade head` létrehozza a táblákat
- [ ] `npm run dev` elindul a React app
- [ ] `.env` fájl tartalmazza: `DATABASE_URL`, `SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NETOPIA_API_KEY`, `NETOPIA_POS_SIGNATURE`

---

## Phase 2: Auth Backend

### Feladatok

1. **Regisztráció** (`POST /api/auth/register`)
   - Email egyediség ellenőrzés
   - `passlib.hash.bcrypt.hash(password)` a jelszóra
   - User rekord létrehozása

2. **Bejelentkezés** (`POST /api/auth/login`)
   - `bcrypt.verify(plain, hashed)` ellenőrzés
   - Session limit: ha `len(sessions) >= 2` → legrégebbi törlése
   - `jti = str(uuid.uuid4())` generálás
   - JWT token: `jwt.encode({"sub": user.id, "jti": jti, "exp": ...}, SECRET_KEY, "HS256")`
   - `UserSession` rekord mentése

3. **Token validáció** (`deps.py: get_current_user`)
   - JWT dekódolás
   - JTI ellenőrzés: létezik-e `UserSession` táblában

4. **Kijelentkezés** (`POST /api/auth/logout`)
   - `UserSession` törlése JTI alapján

5. **Jelszó-visszaállítás** (`POST /api/auth/reset-password`)
   - Email küldés (SMTP vagy SendGrid) időkorlátos tokennel

### Ellenőrzési lista
- [ ] `POST /api/auth/register` → 201, User rekord az adatbázisban
- [ ] `POST /api/auth/login` → JWT token visszaadva
- [ ] Harmadik bejelentkezés kiszorítja a legrégebbit
- [ ] Lejárt/törölt JTI-vel → 401

---

## Phase 3: Tartalomkezelő Backend

### Feladatok

1. **Publikus végpontok** (`GET /api/blocks`, `GET /api/blocks/:slug`)
   - `vimeo_id` mezők SOHA nem szerepelnek a válaszban
   - Blokk adatok + leckék listája (cím + is_free státusz)

2. **Védett stream URL** (`GET /api/lessons/:id/stream-url`)
   ```python
   @router.get("/lessons/{lesson_id}/stream-url")
   async def get_stream_url(
       lesson_id: int,
       current_user: User = Depends(get_current_user),
       session: Session = Depends(get_session)
   ):
       lesson = session.get(Lesson, lesson_id)
       if lesson.is_free:
           return {"embed_url": f"https://player.vimeo.com/video/{lesson.vimeo_id}"}
       
       purchase = session.exec(
           select(Purchase)
           .where(Purchase.user_id == current_user.id)
           .where(Purchase.block_id == lesson.block_id)
           .where(Purchase.expires_at > datetime.utcnow())
       ).first()
       
       if not purchase:
           raise HTTPException(403, "No valid purchase")
       
       return {"embed_url": f"https://player.vimeo.com/video/{lesson.vimeo_id}"}
   ```

3. **Dashboard** (`GET /api/dashboard`)
   - Felhasználó aktív vásárlásai + lejárati dátumok

### Ellenőrzési lista
- [ ] `GET /api/blocks` válaszban nincs `vimeo_id`
- [ ] `GET /api/lessons/1/stream-url` auth nélkül → 401
- [ ] Lejárt vásárlásnál → 403
- [ ] Érvényes vásárlásnál → embed URL visszaadva

---

## Phase 4: Fizetési Backend

### Feladatok

1. **Stripe checkout** (`POST /api/checkout/stripe/:block_id`)
   ```python
   session = stripe.checkout.Session.create(
       success_url=f"{FRONTEND_URL}/dashboard?payment=success",
       cancel_url=f"{FRONTEND_URL}/blocks/{block.slug}",
       line_items=[{"price": block.stripe_price_id, "quantity": 1}],
       mode="payment",
       client_reference_id=str(current_user.id),
       metadata={"block_id": str(block_id)}
   )
   return {"checkout_url": session.url}
   ```

2. **Stripe webhook** (`POST /api/webhooks/stripe`)
   ```python
   event = client.parse_event_notification(body, sig_header, STRIPE_WEBHOOK_SECRET)
   if event.type == "checkout.session.completed":
       user_id = int(event.data.object.client_reference_id)
       block_id = int(event.data.object.metadata["block_id"])
       # Purchase rekord létrehozása, expires_at = most + 180 nap
   ```

3. **Netopia checkout** (`POST /api/checkout/netopia/:block_id`)
   - `netopia-sdk` inicializálás API kulccsal
   - Fizetési kérés indítása (rendelés ID, összeg RON-ban, callback URL)
   - Forrás: https://doc.netopia-payments.com/docs/payment-sdks/python/

4. **Netopia IPN** (`POST /api/webhooks/netopia`)
   ```python
   payment_service.verify_ipn(request.data)  # SDK validálja az RSA aláírást
   # Sikeres fizetésnél Purchase rekord létrehozása
   ```

### Ellenőrzési lista
- [ ] Stripe Checkout URL visszaadva, átirányítás működik
- [ ] Sikeres Stripe fizetés után Purchase rekord létrejön (expires_at helyes)
- [ ] `stripe listen --forward-to localhost:8000/api/webhooks/stripe` tesztelve
- [ ] Netopia sandbox fizetés végigmegy
- [ ] Duplikált webhook nem hoz létre dupla Purchase-t (idempotencia: `payment_id` unique)

---

## Phase 5: React SPA — Alap és Auth

### Feladatok

1. **Design tokenek** (`src/styles/tokens.css`)
   ```css
   /* Másolva: Terapia_weboldal_v4/css/base.css */
   :root {
     --bg-main: #F7F5F2;
     --accent-main: #819A88;
     --font-heading: "Poppins", sans-serif;
     --font-base: "Inter", sans-serif;
     /* ... összes token */
   }
   ```
   Google Fonts import ugyanazokkal a súlyokkal mint a főoldalon.

2. **Auth Context** (`src/context/AuthContext.tsx`)
   - JWT token tárolása `localStorage`-ban
   - `login()`, `logout()`, `isAuthenticated` exportálva
   - Token lejárat kezelése (axios interceptor → 401 → logout)

3. **Axios client** (`src/api/client.ts`)
   ```typescript
   const client = axios.create({ baseURL: import.meta.env.VITE_API_URL });
   client.interceptors.request.use(config => {
     const token = localStorage.getItem("token");
     if (token) config.headers.Authorization = `Bearer ${token}`;
     return config;
   });
   ```

4. **ProtectedRoute** komponens — redirect `/login`-ra ha nincs auth

5. **Login / Register oldalak** — a főoldal form stílusával (`.contact-form` CSS minta)

### Ellenőrzési lista
- [ ] Sikeres login → token eltárolva, redirect dashboardra
- [ ] Védett oldal auth nélkül → redirect `/login`-ra
- [ ] 401 válasz → automatikus logout
- [ ] Vizuális stílus konzisztens a főoldallal (azonos színek, fontok)

---

## Phase 6: React SPA — Nyilvános Oldalak

### Feladatok

1. **Katalógus** (`/`) — `GET /api/blocks` alapján kártyák, bevezető videó szabadon lejátszható

2. **Blokk részletei** (`/blocks/:slug`)
   - Leckék listája (zárt lakat ikon a fizetőseknél)
   - Ár megjelenítése
   - Vásárlás gomb → bejelentkezés, majd checkout

3. **Checkout flow**
   ```
   [Vásárlás gomb] → bejelentkezett? 
     → igen: POST /api/checkout/stripe/:block_id → Stripe URL → átirányítás
     → nem: /login?redirect=/blocks/:slug
   ```
   Netopia opció külön gombként (RON fizetés)

4. **Többnyelvűség** — `i18next` könyvtár, HU/RO/EN JSON fájlok

### Ellenőrzési lista
- [ ] Katalógus betöltődik, blokkok megjelennek
- [ ] Bevezető videó lejátszható bejelentkezés nélkül
- [ ] Vásárlás gomb → Stripe Checkout oldalra irányít
- [ ] HU/RO/EN nyelvváltó működik

---

## Phase 7: React SPA — Védett Oldalak

### Feladatok

1. **Leckelejátszó** (`/learn/:slug/:lesson`)
   ```typescript
   // GET /api/lessons/:id/stream-url
   const { data } = await client.get(`/lessons/${lessonId}/stream-url`);
   // data.embed_url → Vimeo iframe src
   ```
   Vimeo iframe `allow="autoplay; fullscreen"` attribútumokkal  
   Mellette: blokk többi leckéjének listája navigációval

2. **Dashboard** (`/dashboard`)
   - `GET /api/dashboard` → vásárlások, lejárati dátumok
   - Blokkonként: "Folytatás" gomb az utolsó leckére

### Ellenőrzési lista
- [ ] Érvényes vásárlásnál videó betöltődik
- [ ] Lejárt/hiányzó vásárlásnál → 403 kezelt hibaüzenet
- [ ] Dashboard mutatja a lejárati dátumokat
- [ ] Vimeo videó csak a kurz. domainen játszható le (domain-lock aktív)

---

## Phase 8: Integráció és Deploy

### Feladatok

1. **Nav link a főoldalon** — `Terapia_weboldal_v4` minden HTML-jében:
   ```html
   <a href="https://kurz.janosidalma.ro" data-key="nav_courses">Kurzusok</a>
   ```
   `lang.json` kiegészítése: `"nav_courses": {"hu":"Kurzusok","ro":"Cursuri","en":"Courses"}`

2. **Vimeo domain-lock beállítása** minden videóhoz:
   ```
   POST /videos/{video_id}/privacy/domains/kurz.janosidalma.ro
   ```
   Szükséges: fizetős Vimeo csomag (Starter+)

3. **FastAPI deploy** (Railway):
   - `railway.toml` konfigurálása
   - Managed PostgreSQL hozzáadása
   - Env változók beállítása a Railway dashboardon
   - Custom domain: `api.janosidalma.ro`

4. **React SPA deploy** (Vercel):
   - `vercel --prod` a `kurz-app/` mappából
   - Custom domain: `kurz.janosidalma.ro`
   - `VITE_API_URL=https://api.janosidalma.ro` env változó

5. **Stripe webhook endpoint** regisztrálása a Stripe dashboardon: `https://api.janosidalma.ro/api/webhooks/stripe`

### Ellenőrzési lista
- [ ] `kurz.janosidalma.ro` elérhető HTTPS-en
- [ ] `api.janosidalma.ro/docs` Swagger UI megjelenik
- [ ] Nav link megjelenik a főoldalon mindhárom nyelven
- [ ] Vimeo videó más domainen nem játszható le

---

## Phase 9: Végső Ellenőrzés

### End-to-end teszt forgatókönyvek

1. **Regisztráció → vásárlás → lejátszás**
   - Új user regisztrál → emailben megerősítés → bejelentkezik → megvesz egy blokkot Stripe-pal → dashboard mutatja → lecke lejátszik

2. **Session limit teszt**
   - Ugyanaz a user 3 különböző böngészőből jelentkezik be → az első munkamenet kiszorul

3. **Hozzáférés-lejárat teszt**
   - `expires_at` manuálisan múltra állítva → `GET /api/lessons/:id/stream-url` → 403

4. **Megosztott link teszt**
   - Stream URL átmásolva más böngészőbe (ahol nincs bejelentkezés) → 401

### Biztonsági ellenőrzések
- [ ] `vimeo_id` sehol nem szerepel API válaszban (grep: `vimeo_id` a `/api/blocks` response-ban)
- [ ] JWT lejárat 30 perc (nem 24h)
- [ ] Webhook endpoint csak POST-ot fogad, signature mindig ellenőrzött
- [ ] CORS: csak `kurz.janosidalma.ro` és `janosidalma.ro` engedélyezett

---

## Decision Log

| # | Döntés | Alternatívák | Miért |
|---|--------|-------------|-------|
| 1 | FastAPI + PostgreSQL | Django, Node.js | Ismert stack, gyors API fejlesztés |
| 2 | Vimeo domain-lock | YouTube unlisted, saját szerver | Privát videók, beágyazási kontroll |
| 3 | Stripe + Netopia | Csak Stripe, PayPal | Romániai RON fizetés + nemzetközi |
| 4 | Egyszeri vétel, 6 hónap | Előfizetés, örökös | Felhasználói döntés |
| 5 | JWT + JTI session limit | Stateless JWT | Max 2 session kikényszerítése |
| 6 | Railway (FastAPI) + Vercel (React) | VPS, Cloudways | PaaS = kevesebb DevOps |
| 7 | React SPA aldomainen | Vanilla JS, SSR | Jobb state management |
| 8 | Nincs vízjel overlay | CSS overlay a videón | Felhasználói döntés |
