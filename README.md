# LA FONDATION CK — V2.5 corrigée complète

Projet complet **GitHub + Cloudflare Pages + D1 + KV**.

## Nouveautés V2.5

- Nouveau menu **Associations** avec page dédiée.
- Ajout d’associations avec formulaire complet : nom, sigle, domaine, date de création, numéro d’enregistrement, siège, secteur, localité, village, téléphone, e-mail, description et statut.
- Pour chaque association : **liste des membres** et **liste des responsables**, avec ajout, modification, suppression et impression selon les droits du compte.
- La page **Rapport** intègre maintenant Associations, Membres d’associations et Responsables d’associations.
- **Visiteur** : dans Paramètre, accès uniquement à **Mon compte**.
- **Agent** : dans Paramètre, accès uniquement à **Mon compte** et **Support technique**.
- **Sous-administrateur** : dans Paramètre, accès uniquement à **Mon compte** et **Support technique**.
- **Administrateur principal** : accès à toutes les pages et à toute la gestion Paramètre, sauf l’espace Super Admin.
- Un seul **Administrateur principal** peut exister ; son titre est attribué uniquement par le Super Admin.
- Les Visiteurs, Agents et Sous-administrateurs utilisent automatiquement **l’abonnement actif de l’Administrateur principal**. Ils n’ont plus de plan autonome à gérer.
- Le Super Admin ne peut activer un plan que sur l’Administrateur principal ; les autres comptes héritent automatiquement de ce plan.
- Les contrôles de droits sont appliqués côté serveur, pas uniquement dans l’interface.

## Rôles

### Visiteur
- Consultation des pages autorisées.
- Aucune création, modification ou suppression.
- Paramètre : **Mon compte uniquement**.
- Abonnement hérité de l’Administrateur principal.

### Agent
- Pages visibles configurables par l’Administrateur principal.
- Ajout et impression selon autorisations.
- Modification/suppression seulement avec mot de passe d’un Administrateur.
- Paramètre : **Mon compte + Support technique**.
- Abonnement hérité de l’Administrateur principal.

### Sous-administrateur
- Accès complet aux pages de gestion opérationnelle.
- Paramètre : **Mon compte + Support technique** uniquement.
- Abonnement hérité de l’Administrateur principal.

### Administrateur principal
- Accès complet aux pages Secteur, Responsables, Associations, Jeunes filles, Jeunes garçons, Rapport et Paramètre.
- Gestion des utilisateurs, accès Agent, nouvelles du jour, présentation publique, demandes de réinitialisation et messages.
- Gestion de l’abonnement du groupe.
- Le titre est attribué exclusivement par le Super Admin et est limité à une seule personne.

## Cloudflare

Configuration de build :

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

Le mot de passe Super Admin n’est jamais publié dans le dépôt.

## D1

La V2.5 ajoute la migration :

```text
migrations/0004_associations.sql
```

Sur une base existante, le Worker crée automatiquement les tables Associations au premier appel API. Il n’est donc pas nécessaire de supprimer D1.

Pour appliquer les migrations manuellement :

```bash
npm install
npm run db:migrate:remote
```

Tables ajoutées :

```text
associations
association_members
association_responsibles
```

## Sécurité

- Authentification exclusivement côté serveur via `POST /api/login`.
- Hash et sels jamais envoyés au navigateur.
- Cookie `HttpOnly; Secure; SameSite=Lax`.
- CSRF obligatoire pour les écritures.
- Contrôles serveur des rôles et des autorisations.
- Cloisonnement par organisation.
- Plans protégés côté serveur.
- Limitation des tentatives de connexion pendant 15 minutes.
- Invalidation des sessions après changement/réinitialisation du mot de passe.
- Journal des actions sensibles dans D1.
- PBKDF2 limité à 100000 itérations pour compatibilité Cloudflare.

## Mise à jour depuis V2.4

1. Remplacez tout le contenu du dépôt GitHub par le contenu de ce ZIP.
2. Laissez Cloudflare redéployer la branche `main`.
3. Ne supprimez ni D1, ni KV, ni les secrets existants.
4. Ouvrez le site puis faites `Ctrl + F5`.
5. La migration Associations est exécutée automatiquement.


## Version 2.6
Diaporama global à 5 photos optimisées, affichage pleine largeur, tableaux sans débordement et bouton Afficher/Masquer sur tous les champs de mot de passe. Aucune migration D1 supplémentaire n’est nécessaire.
