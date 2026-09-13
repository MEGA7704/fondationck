# LA FONDATION CK — V2.7 corrigée complète

Projet complet **GitHub + Cloudflare Pages + D1 + KV**.

## Nouveautés V2.7

### Associations

- Tableau **Liste des associations** simplifié.
- Colonnes supprimées : **Village**, **Membres**, **Statut**.
- Ajout de la colonne **Responsable**.
- Le formulaire **Ajouter / Modifier une association** contient maintenant le champ obligatoire **Nom du responsable**.
- Le responsable principal est automatiquement inscrit comme **première ligne de la liste des membres**.
- Si le nom du responsable est modifié depuis la fiche Association, la première ligne de la liste des membres est mise à jour automatiquement.
- La ligne du responsable principal est protégée : elle ne se modifie et ne se supprime pas directement depuis la liste des membres.
- La section séparée **Responsables / Liste des responsables de l’association** a été supprimée de l’interface et de l’API de gestion.

### Liste des membres

Le tableau affiche désormais uniquement :

```text
Nom
Sexe
Contact
Village
Activité
Actions
```

Les colonnes **Localité**, **Adhésion** et **Statut** ont été retirées du tableau. Les champs restent disponibles dans le formulaire de membre afin de conserver les informations en base.

### Impression PDF

Les impressions des listes et du Rapport utilisent maintenant une présentation professionnelle :

- A4 paysage ;
- logo et identité de LA FONDATION CK ;
- titre clair du document ;
- date et heure d’édition ;
- tableaux professionnels avec en-têtes verts et alternance des lignes ;
- suppression automatique de la colonne Actions à l’impression ;
- pied de page avec téléphone et e-mail de la Fondation.

Le bouton ouvre la boîte d’impression du navigateur, où l’utilisateur peut choisir **Enregistrer au format PDF**.

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

## D1 — migration V2.7

La V2.7 ajoute :

```text
migrations/0005_association_responsable_principal.sql
```

Elle ajoute :

```text
associations.responsible_name
association_members.is_primary_responsible
```

Sur votre base existante, le Worker applique aussi cette mise à niveau automatiquement au premier appel API. **Ne supprimez pas D1.**

Les anciennes données de `association_responsibles` sont conservées pour compatibilité et peuvent servir à initialiser automatiquement le responsable principal des associations existantes. La section séparée n’est plus utilisée dans l’application.

Pour appliquer les migrations manuellement :

```bash
npm install
npm run db:migrate:remote
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

## Mise à jour depuis V2.6

1. Remplacez tout le contenu du dépôt GitHub par le contenu de ce ZIP.
2. Laissez Cloudflare redéployer la branche `main`.
3. **Ne supprimez ni D1, ni KV, ni les secrets existants.**
4. Ouvrez le site puis faites `Ctrl + F5`.
5. Au premier appel API, la migration V2.7 est appliquée automatiquement.
