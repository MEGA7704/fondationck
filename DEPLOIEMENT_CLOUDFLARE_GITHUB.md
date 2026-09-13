# Déploiement Cloudflare Pages + GitHub

## 1. GitHub

Créez un dépôt, par exemple `la-fondation-ck`, puis envoyez le contenu du projet.

```bash
git init
git add .
git commit -m "Initial LA FONDATION CK"
git branch -M main
git remote add origin VOTRE_URL_GITHUB
git push -u origin main
```

## 2. Cloudflare Pages

Créez un projet Pages à partir du dépôt GitHub. Utilisez le dossier de sortie `public`.

Le fichier `public/_worker.js` est le Worker avancé du projet. Il intercepte les routes `/api/*` et `/media/*`, puis laisse les autres requêtes être servies depuis les fichiers statiques Pages.

## 3. D1 et KV

Les identifiants fournis sont déjà présents dans `wrangler.toml`. Appliquez les migrations D1 :

```bash
npx wrangler d1 migrations apply fondationck-d1 --remote
```

## 4. Compte Super Admin sans secret publié

Dans Cloudflare, ajoutez les secrets :

```bash
npx wrangler pages secret put SUPERADMIN_EMAIL --project-name la-fondation-ck
npx wrangler pages secret put SUPERADMIN_PASSWORD --project-name la-fondation-ck
```

Choisissez vous-même les valeurs quand Wrangler vous les demande. **Ne mettez jamais le mot de passe dans GitHub, dans un fichier JavaScript ou dans une page HTML.**

Au premier appel API après déploiement, le Worker crée automatiquement le compte Super Admin s’il n’existe pas déjà.

## 5. Vérification après déploiement

- Ouvrir la page Accueil et vérifier le logo et les deux photos en arrière-plan.
- Créer un compte visiteur et vérifier le plan Free 10 jours.
- Se connecter avec le Super Admin et créer l’Administrateur principal.
- Depuis le Super Admin, activer le plan voulu pour l’Administrateur.
- Depuis l’Administrateur, créer des secteurs, responsables, jeunes filles/garçons et utilisateurs.
- Dans Paramètre, publier une Nouvelle du jour avec une image.
- Tester la demande Mot de passe oublié pour un utilisateur puis pour un Administrateur.
