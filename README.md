# Simon Morin - Agent de location

Application Web Next.js pour gerer des logements, prospects, correspondances, visites, placements et commissions.

## 1) Prerequis

- Node.js 20+
- npm 10+
- PostgreSQL 15+
- Git

## 2) Installation locale

```bash
npm install
```

## 3) Creation du fichier .env

1. Copier `.env.example` vers `.env`.
2. Remplir au minimum:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/simon_morin_location
SESSION_SECRET=une-cle-secrete-de-plus-de-32-caracteres
```

## 4) Creation des migrations

### En developpement

```bash
npx prisma migrate dev --name init
```

### En deploiement (Render)

```bash
npx prisma migrate deploy
```

## 5) Demarrage local

```bash
npm run prisma:generate
npm run dev
```

Application: http://localhost:3000

## 6) Creation d'un depot GitHub

```bash
git init
git add .
git commit -m "Initial version: Simon Morin Agent de location"
git branch -M main
git remote add origin <url-du-repo>
git push -u origin main
```

## 7) Deploiement avec Render Blueprint

1. Connecter le repo GitHub dans Render.
2. Choisir l'option Blueprint.
3. Render detecte `render.yaml` automatiquement.
4. Valider la creation des services.

## 8) Configuration PostgreSQL

Le service PostgreSQL Render est defini dans `render.yaml`:
- nom: `simon-morin-location-db`
- region: `ohio`
- plan: `free`

La variable `DATABASE_URL` du service Web est liee automatiquement via `fromDatabase.connectionString`.

## 9) Integration Google Agenda (module Visites)

### Variables d'environnement requises

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_CALENDAR_ID` (valeur recommandee: `primary`)
- `GOOGLE_TOKEN_ENCRYPTION_KEY`
- `APP_TIME_ZONE` (valeur recommandee: `America/Toronto`)

Si une variable est manquante, l'application reste fonctionnelle en mode sans Google et affiche un avertissement clair.

### 1. Creer un projet Google Cloud

1. Ouvrir Google Cloud Console.
2. Creer un projet dedie au CRM.

### 2. Activer Google Calendar API

1. Aller dans API & Services > Library.
2. Rechercher "Google Calendar API".
3. Cliquer Activer.

### 3. Configurer l'ecran de consentement OAuth

1. Aller dans API & Services > OAuth consent screen.
2. Choisir External (ou Internal selon votre organisation).
3. Renseigner nom d'application, email de support et domaine si necessaire.
4. Ajouter les scopes:
  - `https://www.googleapis.com/auth/calendar.readonly`
  - `https://www.googleapis.com/auth/calendar.events`
  - `openid`
  - `email`

### 4. Creer les identifiants OAuth (Application Web)

1. Aller dans API & Services > Credentials.
2. Creer un OAuth Client ID de type Web application.
3. Ajouter les URI de redirection autorisees.

### 5. URI de redirection locale

URI locale exacte:

`http://localhost:3000/api/integrations/google/calendar/callback`

### 6. URI de redirection Render

URI Render exacte (remplacer `<votre-service>`):

`https://<votre-service>.onrender.com/api/integrations/google/calendar/callback`

### 7. Ajouter les variables dans Render

Dans le service Web Render, ajouter:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_CALENDAR_ID=primary`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`
- `APP_TIME_ZONE=America/Toronto`

### 8. Connecter le compte Google depuis le CRM

1. Ouvrir `Calendrier` dans le menu.
2. Cliquer `Connecter Google Agenda`.
3. Accepter le consentement.
4. Verifier l'etat "Connecte" et l'email Google dans `/settings/calendar`.

### 9. Tester une demande de visite

1. Ouvrir `/visits`.
2. Selectionner prospect et logement.
3. Chercher les plages disponibles.
4. Selectionner une plage.
5. Soumettre la demande.
6. Verifier le statut `PENDING_APPROVAL`.

### 10. Tester une approbation manuelle

1. Ouvrir `/visits/pending`.
2. Cliquer `Accepter` sur une demande.
3. Verifier passage a `CONFIRMED`.
4. Si Google est connecte:
  - verifier `Evenement Google` sur la carte.
5. Si Google est deconnecte:
  - confirmer l'affichage du mode sans Google.

### 11. Procedure de reconnexion

1. Aller dans `/settings/calendar`.
2. Si le message "Reconnexion Google requise" apparait, cliquer `Reconnecter`.
3. Refaire le consentement OAuth.
4. Verifier la date de derniere synchronisation.

### Securite OAuth

- Les jetons OAuth sont chiffres avant stockage en base.
- Les jetons ne sont jamais retournes par les API.
- Les jetons ne sont jamais affiches dans l'interface ni logs.

## 10) Configuration future Messenger

Variables preparees:
- `META_APP_ID`
- `META_APP_SECRET`
- `META_VERIFY_TOKEN`
- `META_PAGE_ACCESS_TOKEN`

Voir `src/integrations/meta/README.md`.

## 11) Sauvegarde des donnees

- Sauvegarder regulierement la base PostgreSQL (dump SQL).
- Exporter les logements en CSV depuis `/api/properties/export`.
- Conserver l'historique Git du code.

## 12) Passage du forfait gratuit au forfait payant

Version gratuite:
- utilise `buildCommand: npm run render-build`
- ce script execute:
  1. installation dependances
  2. generation Prisma Client
  3. `prisma migrate deploy`
  4. build Next.js

Version payante recommandee:
- conserver `npm run build` en build principal
- deplacer les migrations dans une commande de pre-deploiement:

```bash
npx prisma migrate deploy
```

## Scripts utiles

- `npm run dev`
- `npm run typecheck`
- `npm run test`
- `npm run prisma:generate`
- `npm run prisma:migrate:deploy`
- `npm run prisma:seed`
- `npm run render-build`

## Securite integree

- mot de passe hache (bcrypt)
- session via cookie HTTP-only
- validation Zod
- protection CSRF pour routes critiques
- limitation des tentatives de connexion
- sanitation de texte
- en-tetes de securite
- aucun secret commite (voir `.env.example`)

## Notes de conformite

Le score de correspondance n'utilise jamais l'emploi, l'age, l'origine, la situation familiale, la religion, un handicap ou tout autre renseignement protege.
