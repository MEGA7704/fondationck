# Déploiement exact — LA FONDATION CK V2.10

## 1. GitHub

Décompressez le ZIP et placez directement à la racine du dépôt :

```text
public/
migrations/
package.json
wrangler.toml
README.md
CLOUDFLARE_BUILD_EXACT.txt
INITIALISATION_D1_COMPLETE.sql
```

## 2. Build Cloudflare Pages

```text
Production branch: main
Framework preset: None
Build command: [vide]
Build output directory: public
Root directory: /
```

## 3. Bindings Production

```text
FONDATIONCK_KV -> fondationck-kv
ID: ab4c34a92321484f907ac2793f7ab9d3

FONDATIONCK_DB -> fondationck-d1
ID: e132c09c-f482-41a6-9c99-d5171d7531c1
```

## 4. Secrets Production

```text
SUPERADMIN_EMAIL     Type: Secret
SUPERADMIN_PASSWORD  Type: Secret
```

Ne publiez jamais le mot de passe dans GitHub.

## 5. D1

Ne supprimez pas la base existante. La V2.10 met automatiquement à niveau les secteurs, le responsable principal, les informations de vote et les personnes alliées au premier appel API.

Pour forcer les migrations :

```bash
npm install
npx wrangler d1 migrations apply fondationck-d1 --remote
```

Les fichiers de migration du projet vont de `0001_schema.sql` à `0007_sector_responsables_jeunesse.sql`. Pour une base déjà en production, la migration V2.10 est aussi appliquée automatiquement et de façon idempotente par le Worker.

## 6. Après déploiement

1. Attendez le statut Cloudflare **Success**.
2. Ouvrez `https://fondationck.pages.dev/api/system-status`.
3. Faites `Ctrl + F5` sur le site.
4. Connectez-vous.
5. Le Super Admin attribue le titre **Administrateur principal** à une seule personne.
6. Le Super Admin active ensuite le plan de cet Administrateur principal.
7. Tous les Visiteurs, Agents et Sous-administrateurs de la Fondation utilisent automatiquement ce même abonnement.


## V2.16
La colonne `responsibles.voting_place` est ajoutée automatiquement au premier appel API. Aucune suppression de D1/KV n'est nécessaire.


### Mise à niveau V2.17
Aucune action D1 manuelle n'est requise. Au premier appel API après déploiement, le Worker ajoute automatiquement `ally1_phone` et `ally2_phone` à la table `girls` si nécessaire. Ne supprimez ni D1 ni KV.


### Mise à niveau V2.18
Aucune migration D1 n’est requise. La V2.18 modifie le formulaire Jeunes garçons et renforce la cohérence Secteur / Localité côté serveur.


### Mise à niveau V2.19
Aucune migration D1 ou KV n’est requise. Cette version harmonise uniquement l’affichage des tableaux avec les formulaires d’ajout/modification et conserve les données existantes.
