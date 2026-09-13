# LA FONDATION CK — V2.3 corrigée complète

Projet complet pour **GitHub + Cloudflare Pages + D1 + KV**.

## Mise à jour V2.3 — rapidité, footer et rôles

Cette version ajoute :
- chargement ciblé par page (`/api/load?scope=...`) pour éviter de charger toutes les listes à chaque navigation ;
- bootstrap Super Admin mis en cache dans KV après initialisation réussie afin d'éviter des requêtes D1 répétées ;
- chargements D1 parallélisés dans Paramètre et sur l'accueil public ;
- cache navigateur court pour JS et cache 24 h pour les images/assets ;
- footer maintenu en bas des pages, sans le texte technique Cloudflare ;
- coordonnées Fondation : `0757577542 / 0545202646` et `oukami011@gmail.com` ;
- création autonome des comptes **Administrateur** depuis « Créer un compte » ;
- création par l'Administrateur de deux types de comptes : **Agent** ou **Sous-administrateur** ;
- Agent : pages visibles paramétrables, ajout de lignes et impression selon autorisation ; modification/suppression uniquement avec mot de passe d'un Administrateur ; aucune publication de nouvelles ni gestion des utilisateurs ;
- Sous-administrateur : accès complet comme un Administrateur ;
- bouton **Support technique** dans Paramètre ouvrant WhatsApp vers MEGA SERVICES SARL U (`+225 07 77 04 17 90`).

Aucune suppression des tables D1 existantes n'est requise pour passer de V2.1 à V2.3.


## Correctif principal V2 : Super Admin

La V2 corrige le cas où la page publique fonctionne mais le Super Admin reste absent de D1 et la connexion affiche « Identifiants incorrects ».

Le Worker :
- vérifie les secrets `SUPERADMIN_EMAIL` et `SUPERADMIN_PASSWORD` uniquement côté serveur ;
- crée/répare automatiquement l'organisation principale ;
- crée automatiquement le compte `superadmin` s'il manque ;
- crée son empreinte PBKDF2 dans `credentials` sans publier le mot de passe ;
- si l'utilisateur saisit directement les secrets Super Admin alors que le compte D1 n'existe pas encore, `POST /api/login` force le bootstrap puis recharge le compte ;
- resynchronise l'empreinte si le secret Cloudflare a été changé ;
- retire le blocage de tentatives lié au compte après une réparation réussie ;
- écrit `bootstrap:superadmin:v4 = 1` et `bootstrap:superadmin:status = ready` dans KV quand le bootstrap est terminé ;
- fournit `/api/system-status` pour vérifier les bindings et le bootstrap sans exposer aucun secret.

## Fonctionnalités

- Public : Accueil, Contacts, Connexion, Créer un compte.
- Administrateur : Accueil, Secteur, Responsables, Jeunes filles, Jeunes garçons, Paramètre.
- Création autonome des comptes Administrateur depuis le site.
- Gestion des Agents (pages visibles, ajout, impression) et création de Sous-administrateurs à accès complet.
- Espace Super Admin : comptes, activation/désactivation, suppression autorisée, assistance mot de passe, plans, accès, journal d'audit. Le Super Admin ne crée plus les Administrateurs.
- Nouvelles du jour avec image et page détaillée.
- Plans : Free 10 jours ; Standard 30 jours / 5 100 F ; Business 365 jours / 45 600 F.
- Popup Free à la connexion et toutes les 15 minutes.
- Paiement Wave préconfiguré dans Paramètre.

## Configuration Cloudflare exacte

Consultez `CLOUDFLARE_BUILD_EXACT.txt`.

- Projet Pages : `fondationck`
- Branche : `main`
- Framework preset : `None`
- Build command : vide
- Build output directory : `public`
- Root directory : `/`

Bindings :
- `FONDATIONCK_KV` -> `fondationck-kv`
- `FONDATIONCK_DB` -> `fondationck-d1`

Secrets Production :
- `SUPERADMIN_EMAIL`
- `SUPERADMIN_PASSWORD`

Aucune valeur secrète n'est incluse dans le dépôt.

## D1

Pour une nouvelle base, appliquez les migrations :

```bash
npm install
npm run db:migrate:remote
```

Ou utilisez `INITIALISATION_D1_COMPLETE.sql` dans la console D1 Cloudflare.

## Vérification après déploiement

Ouvrez :

```text
https://fondationck.pages.dev/api/system-status
```

Le résultat attendu est :

```json
{
  "ok": true,
  "database_binding": true,
  "kv_binding": true,
  "superadmin_email_configured": true,
  "superadmin_password_configured": true,
  "organization_exists": true,
  "superadmin_exists": true,
  "superadmin_credential_exists": true
}
```

Puis connectez-vous depuis `/connexion.html` avec les valeurs définies dans les deux secrets Cloudflare.

## Sécurité

- `POST /api/login` côté serveur.
- Hash/sels jamais envoyés au navigateur.
- Sessions KV protégées, cookie `HttpOnly; Secure; SameSite=Lax`.
- CSRF obligatoire sur les écritures authentifiées.
- Contrôles serveur des rôles et de l'organisation.
- Abonnements protégés des modifications non autorisées.
- Limitation des tentatives de connexion par IP et compte pendant 15 minutes.
- Invalidation des sessions après modification/réinitialisation de mot de passe.
- Mots de passe séparés dans `credentials`.
- Journal des actions sensibles dans `audit_log`.


## Correctif V2.1 — PBKDF2 Cloudflare

Cloudflare Pages/Workers refuse dans cet environnement les appels PBKDF2 dépassant 100 000 itérations.
La V2.1 fixe donc `PBKDF2_ITERATIONS` à **100000** côté serveur dans `public/_worker.js`.
La vérification rejette proprement tout ancien hash demandant plus de 100000 itérations au lieu de provoquer une erreur 500.
Lorsqu'il s'agit du Super Admin et que les secrets Cloudflare correspondent, le hash est automatiquement régénéré à 100000 itérations.


## V2.3 — Secteur, Localité et Village

- Le formulaire **Ajouter un secteur** contient maintenant le champ **Village**.
- Le tableau Secteurs affiche **Secteur / Localité / Village**.
- Le formulaire **Ajouter un responsable** utilise une sélection dépendante : **Secteur → Localité → Village**.
- Après le choix d'un secteur, seules ses localités sont proposées ; après le choix de la localité, seuls les villages correspondants sont proposés.
- La Localité et le Village choisis sont enregistrés côté serveur avec le responsable.
- Les bases D1 existantes reçoivent automatiquement les nouvelles colonnes sans suppression des données.
- Les textes demandés concernant la protection des abonnements et la durée du plan Free sur l'écran de création de compte ont été retirés de l'interface.


## V2.4 — Rapport et hiérarchie des comptes

La version 2.4 ajoute la page **Rapport** dans le menu connecté. Elle regroupe les résumés des listes Secteurs, Responsables, Jeunes filles et Jeunes garçons, avec une synthèse par secteur/localité/village.

Tous les nouveaux comptes commencent désormais comme **Visiteur**. Le Visiteur est en consultation seule et, dans Paramètre, ne voit que **Mon compte**. L’**Administrateur principal** peut transformer un Visiteur en **Agent** ou **Sous-administrateur**. Le titre **Administrateur principal** est attribué exclusivement par le **Super Admin** et le serveur refuse automatiquement la présence de deux Administrateurs principaux.

Une migration d’exécution (`migration:account-roles:v2.4`) convertit automatiquement les anciens comptes créés librement comme Administrateurs en Visiteurs. Aucun effacement des listes ou autres données D1 n’est effectué.
