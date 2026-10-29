# Installer et gérer une extension

Objectif : installer une extension, lire la question d'autorisation, puis désactiver ou supprimer l'extension plus tard.

## Quand vous en avez besoin

Une extension ajoute quelque chose à l'application sans que vous deviez attendre une nouvelle version. Une extension peut, par exemple, ajouter un format d'importation qui apparaît dans *Fichier › Importer*, placer un bouton dans le ruban ou fournir une police pour l'export PDF. Le catalogue officiel les répartit en catégories : *Import/Export*, *Planification*, *Rapports*, *Utilitaires*, *Polices* et *Autre*.

Réfléchissez bien avant d'en installer une. Une extension est du code de programme qui s'exécute avec les mêmes droits que l'application elle-même, et l'application ne peut pas les restreindre. C'est pourquoi l'application demande une autorisation à chaque installation. Ce que vous voyez dans cette question est expliqué ci-dessous.

## Étapes

### Installer une extension depuis le catalogue

1. Choisissez *Fichier › Extensions*.
2. Choisissez l'onglet *Parcourir*. L'application charge le catalogue pendant qu'elle affiche *Chargement du catalogue...*. Ce qui figure dans le catalogue est décidé par l'OpenAEC Foundation, qui le maintient, et cela peut changer.
3. Recherchez une extension avec le champ *Rechercher des extensions...*. Il cherche dans le nom, la description, l'auteur et les étiquettes.
4. Chaque carte affiche le nom, la version, la catégorie, la description et l'auteur. Cliquez sur *Installer*.
5. La fenêtre *Installer l'extension ?* s'ouvre. Lisez-la, puis passez à l'étape suivante.
6. Cliquez sur *Installer* pour continuer. Avec *Ne pas installer*, rien ne se passe. Échap ou un clic à côté de la fenêtre compte aussi comme un refus, et l'application n'affiche alors aucun message d'erreur.

Après l'installation, l'extension est activée tout de suite. Sur la carte dans l'onglet *Parcourir*, elle affiche maintenant *Installée*. Ce que l'extension ajoute, vous le voyez dans l'application même : un nouveau bouton dans le ruban, ou un format d'importation dans *Fichier › Importer*. Certaines extensions affichent aussi un message. Vous le reconnaissez au préfixe *Extension*, suivi du nom de l'extension.

**Tutoriels.** Les tutoriels sont une extension. Si vous voyez le bouton *Installer les tutoriels* sous *Tutoriels* dans *Aide*, il ouvre *Fichier › Extensions* sur l'onglet *Parcourir*. La question après la première visite guidée installe aussi cette extension. Les deux voies affichent la même question d'autorisation ; vous pouvez la refuser.

### Installer une extension depuis un fichier

Si vous avez reçu une extension sous forme de fichier, installez-la comme ceci.

1. Choisissez *Fichier › Extensions*.
2. En haut à droite, cliquez sur *ZIP* pour un fichier ZIP, ou sur *JS* pour un fichier JavaScript séparé.
3. Choisissez le fichier. La fenêtre *Installer l'extension ?* s'ouvre, comme ci-dessus.

Un fichier ZIP doit contenir un `manifest.json` et le fichier principal de l'extension. Si vous installez une extension déjà installée, la nouvelle version remplace l'ancienne. Si l'application ne peut pas installer le fichier, par exemple parce qu'un fichier ZIP est endommagé, rien ne se passe : l'application n'affiche aucun message d'erreur pour ZIP et JS, et l'extension n'apparaît pas dans la liste. La raison se trouve pourtant dans le terminal de débogage. Activez-le avec *Paramètres › Projet › Paramètres de l'app*, onglet *Avancé*, *Activer le terminal de débogage*, et ouvrez-le avec le bouton *Afficher le terminal de débogage* dans la barre d'état. Il y affiche par exemple *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (l'application rédige ce texte technique en néerlandais).

### Lire la question d'autorisation

La question montre ce que vous devez décider.

- *Auteur* et *Dépôt* indiquent qui a créé l'extension et où se trouve le code source.
- *Origine* indique d'où vient le fichier et s'il a été vérifié. Si l'application indique en rouge que le téléchargement n'a pas été vérifié, n'installez que si vous connaissez la source.
- *Ce que vous acceptez* rappelle qu'une extension est du code qui s'exécute avec les mêmes droits que l'application elle-même, et ce que cela signifie sur votre plateforme. N'installez que des extensions dont vous faites confiance à l'auteur.
- *Ce que cette extension déclare utiliser* affiche les autorisations que l'auteur a déclarées, sous forme de petites étiquettes. C'est une déclaration et non une restriction. S'il indique *Rien de déclaré.*, l'extension peut quand même lire et modifier les données de votre planning.

La signification de chaque étiquette et les textes exacts de la fenêtre se trouvent dans [Autorisations des extensions](docs://ref-extensiepermissies).

### Désactiver, réactiver ou supprimer une extension

1. Choisissez *Fichier › Extensions*, puis l'onglet *Installées*. Chaque extension a une carte avec le nom, la version, la catégorie, la description et l'auteur.
2. Avec l'interrupteur sur la carte, vous désactivez l'extension (*Désactiver*) ou vous la réactivez (*Activer*). Lorsqu'elle est désactivée, les boutons et formats d'importation que l'extension a ajoutés disparaissent, mais l'extension reste installée. Elle reste aussi désactivée après un redémarrage de l'application. Une extension activée démarre seule au lancement de l'application.
3. Cliquez sur *Retirer*. Le bouton devient *Confirmer*, avec l'explication *Cliquez à nouveau pour supprimer définitivement*. Cliquez encore une fois pour supprimer l'extension. L'application nettoie aussi les réglages que l'extension a enregistrés.

## Pièges et ce que fait alors l'application

**Le catalogue ne se charge pas.** Il affiche *Impossible de charger le catalogue :* avec la raison technique après, et le bouton *Réessayer*. Cela peut venir de l'absence de connexion internet.

**Il affiche *Échec de l'installation.* sous une carte du catalogue.** Le téléchargement ou l'installation a échoué, par exemple parce que la somme de contrôle ne correspond pas. Rien n'a alors été installé. C'est différent d'un refus de la question : dans ce cas, il n'y a pas de message d'erreur.

**Il affiche *Entrées du catalogue ignorées : 1* au-dessus de la liste.** Le catalogue contenait un élément que l'application ne peut pas utiliser. Vous pouvez installer les autres extensions comme d'habitude.

**Une extension ne démarre pas.** La carte affiche alors un message d'erreur, par exemple que l'extension demande une version plus récente d'Open Planner Studio, avec votre version actuelle affichée, ou l'erreur que l'extension elle-même a donnée. L'extension n'est alors pas active. Mettez l'application à jour, ou supprimez l'extension.

**Une carte avec *Quarantaine*.** L'application n'a pas pu utiliser l'extension enregistrée. Sous le nom, elle affiche *Raison :* avec la cause. Avec *Supprimer du stockage*, vous la nettoyez.

**Écrire soi-même une extension.** Le guide pour les auteurs d'extensions (manifeste, API, autorisations) se trouve dans le dépôt `OpenAEC-Foundation/open-planner-studio` sur GitHub, dans le fichier `docs/extensions.md`.

**Une extension n'appartient pas à un projet.** Les extensions sont stockées dans l'application : dans l'application de bureau sur cet ordinateur, et dans le navigateur, dans le stockage de ce navigateur. Elles s'appliquent à tous vos projets et ne font pas partie de votre fichier de projet. Si vous effacez les données du site dans le navigateur, les extensions disparaissent.

## Voir aussi

- [Mettre à jour l'application](docs://howto-app-bijwerken): une extension peut demander une version plus récente de l'application.
- [Autorisations des extensions](docs://ref-extensiepermissies): ce que signifie chaque autorisation dans la question d'installation.
