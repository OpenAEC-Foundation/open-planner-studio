# Gérer et installer des extensions

Les extensions ajoutent des fonctionnalités à l'application, comme des formats d'import supplémentaires ou des boutons de ruban personnalisés. Elles sont au niveau de l'application : elles appartiennent à cette installation sur cet appareil, pas à un fichier de projet.

## Ouverture

**Fichier** → **Extensions** (Backstage). En haut se trouvent deux onglets — **Installées** et **Parcourir** — à côté des boutons **ZIP** et **JS**, avec un champ de recherche en dessous (**Rechercher des extensions...**).

## Installées

Une carte par extension avec le nom, la version, la catégorie, la description et l'auteur, plus :

- **Interrupteur activer/désactiver** — active ou désactive l'extension sans la supprimer.
- **Supprimer** — cliquez une nouvelle fois sur **Confirmer** pour la supprimer définitivement.

Une extension qui n'a pas pu se charger affiche un message d'erreur sur sa carte. Sans extension, l'onglet indique : « Aucune extension installée. »

## Parcourir (catalogue)

L'onglet **Parcourir** récupère le catalogue d'extensions en ligne (connexion internet requise). Chaque entrée du catalogue est une carte avec **Installer** ; les extensions déjà installées affichent le badge **Installée**. Si le chargement échoue, un message d'erreur apparaît avec **Réessayer**.

## Installer depuis un fichier

- **ZIP** — installe une extension ZIP (avec `manifest.json` + `main.js`).
- **JS** — installe un seul fichier `.js` avec un manifeste intégré.

Après l'installation, l'extension est activée immédiatement et tout bouton de ruban apparaît aussitôt.

## Importer via les extensions

**Fichier** → **Importer** liste les formats d'import proposés par les extensions installées ; cliquez sur un format et choisissez un fichier. Sans extension d'import, la page indique : « Aucune extension d'import installée. Ajoutez-en une via Extensions. » Les formats d'import intégrés (CSV, MS Project, P6) sont distincts de ceci — voir [Im-/export](docs://gids-import-export).

## Écrire ses propres extensions

Le guide pour les auteurs d'extensions (manifeste, API, permissions) se trouve dans le dépôt : `github.com/OpenAEC-Foundation/open-planner-studio`, fichier `docs/extensions.md`.
