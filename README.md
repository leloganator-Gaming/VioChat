# Wolfanator

Jeu multijoueur original de Loups-Garous en ligne, avec comptes Supabase, salons en temps réel et progression.

## Site
GitHub Pages : https://leloganator-gaming.github.io/Wolfanator/

## Stack
- Frontend statique : HTML, CSS et JavaScript.
- Authentification, base de données et temps réel : Supabase.
- Clé navigateur : clé publishable uniquement dans `config.js`. Ne jamais publier de clé `service_role` ou `sb_secret`.

## Fonctionnalités présentes
- Inscription, connexion et profils avec pseudo.
- Salons publics/privés, code d'accès, joueurs prêts et gestion par l'hôte.
- Hub de partie avec scène, discussion et composition.
- Moteur de base jour/nuit avec Loup-garou, Voyante, Protecteur, Sorcière, Ancien et Villageois.
- Chat de meute séparé.
- Historique de parties, Lunes, grade Loup Alpha et outils administrateur.
- Encyclopédie de 21 rôles principaux et 9 variantes.
- Classement par lauriers, demandes d'amis, niveaux/XP, boutique cosmétique, inventaire, signalements et modération des signalements dans la console administrateur.

## État important
Le catalogue des 30 rôles est disponible dans l'encyclopédie. Cela ne signifie pas que les 30 pouvoirs sont déjà jouables : le moteur de partie actuel ne distribue et ne résout encore que les rôles de base listés ci-dessus. Les écrans communautaires, la boutique, les signalements et la modération utilisent les tables et RPC Supabase ajoutés le 16 novembre 2026. Le classement est ordonné par lauriers.

## Base Supabase
Projet : `bphfjhmmfwsnjnbnjkjl`

Migrations ajoutées :
- `20261116190420_wolfanator_social_progression_and_catalog`
- `20261116190432_wolfanator_friendship_update_guard`

Les tables exposées utilisent RLS. Les achats cosmétiques sont des achats directs avec des Lunes, sans tirage aléatoire.

## Fichiers principaux
- `index.html` : structure de la page.
- `style.css` : interface responsive.
- `app.js` : authentification, salons, partie et administration.
- `features.js` : encyclopédie, classement, amis, boutique et profil enrichi.
- `config.js` : URL Supabase et clé publishable.
