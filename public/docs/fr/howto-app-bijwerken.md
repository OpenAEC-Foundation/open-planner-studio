# Mettre à jour l'application

Objectif : savoir si vous avez la dernière version, mettre à jour l'application et lire ce qui est nouveau dans une version.

## Quand vous en avez besoin

Une nouvelle version d'Open Planner Studio sort régulièrement. Vous voulez savoir si vous l'avez déjà, par exemple avant de signaler une erreur ou parce qu'une extension demande une version plus récente. Ou vous venez de mettre à jour et vous voulez voir ce qui a changé.

La mise à jour fonctionne uniquement dans l'application de bureau. La version navigateur n'a pas de module de mise à jour.

## Étapes

### Mettre à jour quand l'application indique elle-même une nouvelle version

1. Démarrez l'application de bureau. Au démarrage, l'application vérifie en arrière-plan s'il existe une nouvelle version. S'il n'existe pas de nouvelle version, ou si la vérification échoue, par exemple sans connexion Internet, vous ne remarquez rien.
2. S'il existe une nouvelle version, la fenêtre *Mise à jour du logiciel* s'ouvre. Elle affiche la *Version actuelle*, la *Nouvelle version*, le message *Une nouvelle version est disponible* et, sous *Nouveautés*, le texte qui accompagne la mise à jour.
3. Enregistrez vos projets ouverts.
4. Cliquez sur *Télécharger et installer*. Une barre de progression affiche *Téléchargement…*, puis l'installation suit. Vous ne pouvez pas fermer la fenêtre pendant le téléchargement.
5. Attendez que l'application redémarre seule. C'est la nouvelle version.

Juste avant l'installation de la mise à jour, l'application crée aussi un instantané de récupération de votre travail en cours, pour la récupération après plantage. Voir [Récupération après un plantage](docs://howto-herstellen-na-een-crash).

### Vérifier vous-même s'il existe une nouvelle version

1. Choisissez *Paramètres › Projet › Paramètres de l'application*. Vous pouvez aussi choisir *Fichier › Paramètres de l'application*, ou l'engrenage en haut.
2. Choisissez l'onglet *Avancé*. Sous *Version* se trouve le numéro de votre version actuelle.
3. Cliquez sur *Rechercher des mises à jour*. La fenêtre *Mise à jour du logiciel* s'ouvre et affiche *Vérification…*. Ensuite, elle affiche *Vous utilisez la dernière version* ou le message indiquant qu'une nouvelle version existe, avec le même bouton *Télécharger et installer*.

Dans le navigateur, ce bouton n'a pas d'effet particulier : la fenêtre affiche tout de suite *Vous utilisez la dernière version*, sans que l'application vérifie quoi que ce soit.

### Lire les nouveautés

1. Si vous démarrez l'application de bureau pour la première fois dans une autre version que la dernière fois, une fenêtre s'ouvre seule. Elle s'intitule *Vous êtes à jour !* Après une installation neuve, elle ne s'ouvre pas : le premier démarrage n'est pas une mise à jour. Si vous voulez quand même la voir, utilisez le bouton *Nouveautés* (voir ci-dessous).
2. En haut, vous voyez le passage de la version précédente à la nouvelle version. Avec le bouton *Nouveautés*, seule la nouvelle version s'affiche.
3. Si l'application contient un résumé intégré pour cette version, vous voyez un point principal et quatre points secondaires. Le point principal peut avoir un bouton *Lire le guide*. Sinon, vous voyez seulement le passage de version et ce qui se trouve dessous.
4. Avec *Voir les notes de version*, vous ouvrez le journal des modifications sur GitHub. Si cela ne fonctionne pas, l'application affiche *Les notes de version n’ont pas pu être ouvertes.*
5. Sous *Cette mise à jour en chiffres*, vous voyez le nombre de jours depuis la version précédente, le nombre de commits et le nombre de lignes de code ajoutées. Si l'application peut déterminer la différence de taille du paquet d'installation, cette valeur s'affiche aussi. Chaque chiffre s'affiche seulement s'il est disponible.
6. Cliquez sur *Compris* pour fermer la fenêtre.

Si vous voulez revoir cette fenêtre plus tard, choisissez *Paramètres › Projet › Paramètres de l'application*, onglet *Avancé*, et sous *Version* le bouton *Nouveautés*. La fenêtre s'ouvre alors pour votre version actuelle, sans version précédente.

## Pièges et ce que fait alors l'application

**La mise à jour échoue.** La fenêtre affiche *Une erreur s'est produite lors de la mise à jour*, avec la raison technique en dessous, et le bouton *Réessayer*.

**Vous avez installé l'application comme paquet .deb et l'installation échoue.** La fenêtre explique : *Mettez à jour manuellement en exécutant cette commande dans un terminal, ou téléchargez le dernier paquet.* Sous *Commande d'installation* se trouve la commande, avec le bouton *Copier la commande* (ensuite, il affiche *Copié*). Avec *Ouvrir la page de téléchargement*, vous allez sur la page de téléchargement de la dernière version.

**Vous avez l'application via le Snap Store.** L'application ne se met alors pas à jour seule et ne vérifie pas non plus au démarrage. Le Snap Store s'en charge. Dans la fenêtre, il est écrit : *Cette version est mise à jour automatiquement via le Snap Store — vous n'avez rien à faire.*

**Rien n'apparaît au démarrage.** C'est normal si vous avez déjà la dernière version. La vérification au démarrage ne signale pas d'erreurs. Si vous voulez être sûr d'être à jour, vérifiez vous-même, comme ci-dessus.

## Voir aussi

- [Envoyer des commentaires](docs://howto-feedback-geven) : signaler une erreur dans la dernière version.
