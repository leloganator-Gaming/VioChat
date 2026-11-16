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
- Moteur jour/nuit avec actions serveur pour les camps de loups, les variantes de Voyante, le Protecteur, le Garde, les potions de Sorcière/Guérisseuse/Empoisonneuse et l'Ancien.
- Chat de meute séparé.
- Historique de parties, Lunes, grade Loup Alpha et outils administrateur.
- Catalogue Supabase de 32 rôles, dont les rôles Alpha.
- Classement par lauriers, demandes d'amis, niveaux/XP, boutique cosmétique, inventaire, signalements et modération des signalements dans la console administrateur.

## État important
Les 32 rôles peuvent maintenant être choisis dans la composition d'un salon, enregistrés par le hub et distribués par le serveur au lancement. Les rôles Alpha (Mercenaire, Rat Malade et Pillard) sont contrôlés côté serveur par l'entitlement `wolf_alpha`. Le moteur sait aussi traiter les actions communes aux factions de loups, l'infection du Loup Noir, les variantes de Voyante, le Protecteur/Garde, les rôles à potion, les liens de Cupidon, le dernier tir du Chasseur, l'espionnage de la Petite Fille, les protections conditionnelles des Chaperons, les devinettes du Nain Tracassin, la contamination du Rat Malade, l'héritage de l'Héritier et du Pillard, et l'objectif du Mercenaire au premier jour. Attention : la distribution de tous les rôles ne signifie pas que chaque pouvoir spécial est terminé. Les pouvoirs complexes (Loup Blanc, Loup Bavard, Loup Lettré, Dictateur, Pyromancien, Nécromancien, Fossoyeur, Mentaliste et Chaperon Rose) restent à implémenter et à tester individuellement avant de considérer le jeu complet. Les écrans communautaires, la boutique, les signalements et la modération utilisent les tables et RPC Supabase ajoutés le 16 novembre 2026. Le classement est ordonné par lauriers.

## Base Supabase
Projet : `bphfjhmmfwsnjnbnjkjl`

Migrations ajoutées :
- `20261116190420_wolfanator_social_progression_and_catalog`
- `20261116190432_wolfanator_friendship_update_guard`
- `wolfanator_full_role_compositions_and_assignment`
- `wolfanator_alpha_role_entitlement_guard`
- `wolfanator_split_protector_and_potion_roles` (applied in focused steps)

Les tables exposées utilisent RLS. Les achats cosmétiques sont des achats directs avec des Lunes, sans tirage aléatoire.

## Fichiers principaux
- `index.html` : structure de la page.
- `style.css` : interface responsive.
- `app.js` : authentification, salons, partie et administration.
- `features.js` : encyclopédie, classement, amis, boutique et profil enrichi.
- `config.js` : URL Supabase et clé publishable.
