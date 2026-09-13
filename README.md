# LA FONDATION CK — Cloudflare Pages + GitHub + D1 + KV

Projet prêt à déposer sur GitHub puis à connecter à **Cloudflare Pages**.

## Fonctionnalités incluses

- Site public : **Accueil**, **Contacts**, **Connexion**, **Créer un compte**.
- Espace connecté : **Accueil**, **Secteur**, **Responsables**, **Jeunes filles**, **Jeunes garçons**, **Paramètre**.
- Gestion des utilisateurs par l’Administrateur avec droits de visibilité par page.
- Espace **Super Admin** séparé : création d’Administrateurs, activation/désactivation, suppression de comptes, réinitialisation des mots de passe, gestion des abonnements, gestion des accès et journal de sécurité.
- Actualités : création d’une page d’information avec image, affichée sous forme de carte sur l’accueil.
- Images d’actualités stockées dans KV ; données structurées dans D1.
- Plans : Free 10 jours, Standard 30 jours / 5 100 F, Business 365 jours / 45 600 F.
- Popup du plan Free à la connexion puis toutes les 15 minutes.
- Paiement Wave préconfiguré dans la page Paramètre.

## Bindings Cloudflare déjà configurés

- KV : `fondationck-kv` — ID `ab4c34a92321484f907ac2793f7ab9d3`
- D1 : `fondationck-d1` — ID `e132c09c-f482-41a6-9c99-d5171d7531c1`
- Binding KV utilisé par le Worker : `FONDATIONCK_KV`
- Binding D1 utilisé par le Worker : `FONDATIONCK_DB`

## Déploiement rapide

1. Créez un dépôt GitHub et déposez tout le contenu de ce dossier à la racine du dépôt.
2. Dans Cloudflare Pages, créez un projet connecté à ce dépôt GitHub.
3. Le répertoire publié est `public`. Aucun framework n’est nécessaire.
4. Installez Wrangler localement si nécessaire : `npm install`.
5. Appliquez les migrations D1 :

```bash
npm run db:migrate:remote
```

6. Dans **Cloudflare Pages > Settings > Variables and Secrets**, créez **deux secrets** :
   - `SUPERADMIN_EMAIL` : choisissez l’adresse e-mail du Super Admin.
   - `SUPERADMIN_PASSWORD` : choisissez un mot de passe fort.

**Aucun mot de passe Super Admin n’est fourni ni enregistré dans le dépôt.** Le Worker crée le compte côté serveur à partir des secrets Cloudflare, puis stocke uniquement une empreinte PBKDF2 dans la table `credentials`.

7. Vérifiez les bindings D1/KV dans Cloudflare si votre mode de déploiement ne reprend pas automatiquement `wrangler.toml`.
8. Déployez le projet.

## Sécurité mise en place

- `POST /api/login` réel côté Worker.
- Vérification des mots de passe uniquement dans `public/_worker.js`.
- Les empreintes et sels ne sont jamais renvoyés au navigateur.
- `GET /api/load` et `POST /api/save` exigent une session valide.
- Cookie de session : `HttpOnly; Secure; SameSite=Lax`.
- Jeton CSRF obligatoire pour les écritures authentifiées.
- Contrôle serveur des rôles `member`, `admin`, `superadmin`.
- Requêtes D1 limitées à `organization_id` de la session, sauf opérations Super Admin explicitement autorisées.
- Un Administrateur ne peut pas modifier son propre plan ou son statut : ces opérations appartiennent au Super Admin.
- Blocage des tentatives de connexion pendant 15 minutes par IP et par compte après plusieurs échecs.
- Toute modification/réinitialisation de mot de passe incrémente `session_version`, ce qui invalide toutes les anciennes sessions.
- Les mots de passe sont stockés dans `credentials`, séparément des données générales de `users`.
- Migration défensive des anciens champs `users.password_hash` vers `credentials` si un ancien schéma est détecté.
- Journal D1 des actions sensibles dans `audit_log`.
- En-têtes de sécurité dans `public/_headers`.

## Mot de passe oublié

- Le visiteur fait une demande depuis le lien **Mot de passe oublié ?**.
- Si le compte est un **Administrateur**, la demande apparaît dans l’espace Super Admin.
- Si le compte est un **utilisateur**, la demande apparaît dans Paramètre > Mots de passe oubliés de son Administrateur.
- La réinitialisation impose un nouveau mot de passe temporaire et invalide toutes les anciennes sessions.

## Paiement Wave

- Standard : `5 100 F / 30 jours`.
- Business : `45 600 F / 365 jours`.
- L’activation du plan reste une action Super Admin afin de protéger les statuts d’abonnement.

## Développement local

Copiez `.dev.vars.example` vers `.dev.vars`, remplacez les valeurs par vos secrets locaux, puis :

```bash
npm install
npm run db:migrate:local
npm run dev
```

Ne publiez jamais `.dev.vars`.
