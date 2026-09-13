# LA FONDATION CK — V2.9 corrigée complète

Projet **GitHub + Cloudflare Pages + D1 + KV**.

## Nouveautés V2.9

### Secteur

La page **Secteur** devient une page de gestion synchronisée. Le tableau affiche :

```text
Secteur | Localité | Responsable | Contact | Jeunes filles | Jeunes garçons | Actions
```

Les colonnes **Village** et **Description** sont retirées du tableau et du formulaire Secteur.

Le bouton **Ajouter secteur et responsable** ouvre un formulaire commun contenant le secteur et son responsable principal. L’action **Ouvrir** affiche les listes des jeunes filles et des jeunes garçons rattachées au secteur avec le responsable du secteur.

### Jeunes filles

Chaque fiche peut enregistrer :

- nom et contact ;
- secteur et responsable ;
- sexe ;
- bureau de vote ;
- lieu de vote ;
- jusqu’à **deux personnes alliées** ;
- pour chaque allié : nom, sexe, bureau de vote et lieu de vote.

### Jeunes garçons

Chaque fiche peut enregistrer :

- nom ;
- secteur et responsable ;
- contact ;
- bureau de vote ;
- lieu de vote.

Aucune personne alliée n’est prévue pour les jeunes garçons.

### Synchronisation

Les pages **Secteur**, **Responsables**, **Jeunes filles**, **Jeunes garçons** et **Rapport** lisent les mêmes données D1. Les ajouts et modifications sont donc synchronisés entre les pages.

## Mise à niveau D1

La V2.9 ajoute côté serveur :

- `responsibles.is_primary` ;
- informations de vote des jeunes filles et garçons ;
- deux personnes alliées pour chaque jeune fille.

Pour une base D1 existante, `_worker.js` applique automatiquement cette mise à niveau au premier appel API. **Ne supprimez ni D1 ni KV.**

Les nouvelles installations disposent aussi du schéma complet dans `migrations/0001_schema.sql`.

## Cloudflare Pages

```text
Production branch: main
Framework preset: None
Build command: [vide]
Build output directory: public
Root directory: /
```

Bindings :

```text
FONDATIONCK_KV -> fondationck-kv
FONDATIONCK_DB -> fondationck-d1
```

Secrets Production :

```text
SUPERADMIN_EMAIL
SUPERADMIN_PASSWORD
```

## Déploiement

1. Remplacez le contenu du dépôt GitHub par celui de ce ZIP.
2. Laissez Cloudflare redéployer `main`.
3. Ne supprimez pas D1, KV ou les secrets.
4. Ouvrez le site et faites `Ctrl + F5`.
5. Le premier appel API applique automatiquement la migration V2.9 sur une base existante.

## Sécurité conservée

- authentification serveur via `/api/login` ;
- cookie HttpOnly, Secure, SameSite=Lax ;
- CSRF obligatoire pour les écritures ;
- contrôle serveur des rôles et autorisations ;
- cloisonnement par organisation ;
- limitation des tentatives de connexion ;
- journal d’audit D1 ;
- mots de passe exclusivement vérifiés côté serveur ;
- PBKDF2 limité à 100000 itérations pour compatibilité Cloudflare.
