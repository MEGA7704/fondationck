# Déploiement exact — LA FONDATION CK V2

## 1. GitHub

Décompressez le ZIP. Le dépôt GitHub doit avoir directement à sa racine :

```text
public/
migrations/
package.json
wrangler.toml
README.md
CLOUDFLARE_BUILD_EXACT.txt
INITIALISATION_D1_COMPLETE.sql
```

Ne placez pas ces fichiers dans un sous-dossier supplémentaire.

## 2. Cloudflare Pages

Connectez le dépôt au projet **fondationck**.

Configuration :

```text
Production branch: main
Framework preset: None
Build command: [vide]
Build output directory: public
Root directory: /
```

## 3. Bindings Production

KV :

```text
Variable name: FONDATIONCK_KV
Namespace: fondationck-kv
ID: ab4c34a92321484f907ac2793f7ab9d3
```

D1 :

```text
Variable name: FONDATIONCK_DB
Database: fondationck-d1
ID: e132c09c-f482-41a6-9c99-d5171d7531c1
```

## 4. Secrets Production

Dans Paramètres > Variables et secrets > environnement Production :

```text
SUPERADMIN_EMAIL     Type: Secret
SUPERADMIN_PASSWORD  Type: Secret
```

Définissez vos propres valeurs. Ne publiez jamais le mot de passe.

Après ajout/modification d'un secret ou binding, lancez un **nouveau déploiement Production**.

## 5. Base D1

Si les tables existent déjà, ne les supprimez pas.

Pour une nouvelle base :

```bash
npm install
npx wrangler d1 migrations apply fondationck-d1 --remote
```

Alternative : copier `INITIALISATION_D1_COMPLETE.sql` dans la console D1.

## 6. Test obligatoire V2

Après le déploiement, ouvrez :

```text
https://fondationck.pages.dev/api/system-status
```

Tous les indicateurs doivent être `true`, notamment :

```text
superadmin_email_configured
superadmin_password_configured
superadmin_exists
superadmin_credential_exists
```

La visite de cette route déclenche aussi l'auto-réparation du Super Admin avant d'afficher l'état.

Ensuite ouvrez :

```text
https://fondationck.pages.dev/connexion.html
```

et utilisez exactement les valeurs des secrets `SUPERADMIN_EMAIL` et `SUPERADMIN_PASSWORD`.


## Après mise à jour V2.1
1. Remplacer tout le contenu du dépôt GitHub par celui de ce ZIP.
2. Attendre le nouveau déploiement Production.
3. Ouvrir `https://fondationck.pages.dev/api/system-status`.
4. Le bootstrap Super Admin doit passer à `ready` et la clé KV `bootstrap:superadmin:error` est supprimée automatiquement.
5. Se connecter avec les valeurs secrètes `SUPERADMIN_EMAIL` et `SUPERADMIN_PASSWORD`.

Aucune suppression manuelle de D1 n'est nécessaire.
