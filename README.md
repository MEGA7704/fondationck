# LA FONDATION CK — V2.21

Correction ciblée du popup **Ajouter / Modifier un responsable** : le champ **Localité** est masqué pour la fonction **Responsable de secteur**, et affiché pour **Responsable des jeunes filles** et **Responsable des jeunes garçons**. La règle d’unicité déjà imposée reste inchangée. Voir `CORRECTIONS_V2_21.txt`.

# LA FONDATION CK — V2.13

Cette version ajoute le décompte des alliés des jeunes filles dans la page Rapport et la mention ©2026 Méga Services SARL U - Tous droits réservés dans le footer.

## V2.12 — Carrousel Actualités dans le hero et arrière-plan mobile corrigé

Voir `CORRECTIONS_V2_12.txt`.

## Correction V2.11

Dans la Liste des secteurs, les colonnes de décompte « Jeunes filles » et « Jeunes garçons » ont été supprimées.

# LA FONDATION CK — V2.10 corrigée complète

Projet **GitHub + Cloudflare Pages + D1 + KV**.

## Précision V2.10 — responsables par secteur

Chaque secteur possède désormais **trois responsables distincts** : responsable du secteur, responsable des jeunes filles et responsable des jeunes garçons. Le formulaire Secteur enregistre les trois noms. Le tableau Secteur les affiche directement et le bouton **Ouvrir** a été retiré de la colonne Actions.

La synchronisation est assurée par D1 : les responsables spécialisés sont visibles dans la page **Responsables**, la page **Jeunes filles** affiche le responsable des jeunes filles du secteur, la page **Jeunes garçons** celui des jeunes garçons, et le **Rapport** reprend les trois responsables.


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

## V2.16 — Suppression d'un secteur
La suppression d'un secteur est maintenant une suppression en cascade métier : responsables, jeunes filles, jeunes garçons, associations liées et membres de ces associations sont supprimés en même temps. Un avertissement de confirmation est affiché avant l'opération.


## V2.16 — Responsables
Le formulaire Responsables ne contient plus Village. La fonction est limitée aux trois rôles officiels, avec contrôle d’unicité par localité et ajout du lieu de vote.


## V2.17 — Jeunes filles : Secteur/Localité dépendants et contacts des alliés
Le formulaire Jeunes filles sépare Secteur et Localité. La liste Localité dépend du secteur sélectionné. Deux champs Contact ont été ajoutés pour les personnes alliées 1 et 2, avec migration D1 automatique et sans perte de données.


## V2.18 — Jeunes garçons : Secteur / Localité dépendants

- Dans **Ajouter / Modifier un jeune garçon**, les champs **Secteur** et **Localité** sont séparés.
- **Secteur** est une liste déroulante alimentée par les secteurs enregistrés.
- **Localité** devient une liste déroulante dépendante : elle ne propose que les localités du secteur choisi.
- La combinaison Secteur / Localité est contrôlée avant enregistrement.
- Le serveur recalcule la localité depuis le secteur sélectionné afin d’éviter une association incohérente.
- Aucune migration D1 n’est nécessaire pour cette version.


## V2.19 — Tableaux adaptés aux formulaires d’ajout
- Secteurs : tableau recentré sur Secteur / Localité et responsables synchronisés, sans colonne Contact étrangère au formulaire Secteur.
- Responsables : regroupement Secteur / Localité et Contact, tout en affichant toutes les données du formulaire.
- Jeunes filles : le tableau reprend Secteur, Localité, contact/sexe, vote, naissance/activité et les deux alliés avec leurs contacts.
- Jeunes garçons : le tableau reprend Secteur, Localité, contact, vote, naissance et activité/études.
- Associations : toutes les informations du formulaire sont reprises dans des colonnes regroupées pour éviter les débordements.
- Membres : Téléphone et E-mail sont regroupés dans Contact, en conservant les colonnes précédemment supprimées hors du tableau.
- Utilisateurs : ajout de la colonne Téléphone ; le mot de passe reste volontairement jamais affiché.
- Nouvelles du jour : ajout des aperçus Résumé et Contenu, avec statut de publication.
Aucune migration D1 n’est requise.

## V2.22 — Ordre Fonction / Localité des responsables
Dans le formulaire Responsable, le champ Fonction est affiché avant Localité. Localité est masquée pour « Responsable de secteur » et affichée pour les deux fonctions jeunesse, sans modifier les contrôles d’unicité déjà en place.
