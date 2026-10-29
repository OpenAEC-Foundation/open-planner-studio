# Permissions des extensions

Voici chaque permission qu'une extension peut déclarer dans son manifeste : ce qu'elle autorise, ce qui se passe quand elle manque et ce que vous voyez à l'installation d'une extension. La façon de gérer et d'installer les extensions est décrite dans [Installer et gérer une extension](docs://howto-extensie-installeren).

## Ce qu'est une permission, et ce qu'elle n'est pas

Une permission est une **déclaration de l'auteur** : elle indique quelles parties de l'interface de l'application l'extension veut utiliser. Ce n'est pas une barrière. Le code d'une extension s'exécute dans le même environnement que l'application elle-même. Il peut donc faire davantage que ce que ses permissions indiquent : il n'existe pas de bac à sable. L'application le signale aussi dans la fenêtre d'installation. N'installez que des extensions d'auteurs en qui vous avez confiance.

L'application applique une permission de l'une de trois manières, et la différence compte :

**Application stricte.** Si la permission manque, la méthode correspondante lève une erreur (en néerlandais, par exemple *Extensie « … » mist permissie: ribbon*) avant que quoi que ce soit ne se passe.

**Avertissement.** Si la permission manque, la méthode fonctionne quand même, mais l'application écrit un avertissement dans le journal. Dans une version future, cela devient un refus.

**Informatif uniquement.** La permission n'est liée à aucune partie de l'interface. L'application l'affiche à l'installation et ne fait rien d'autre avec elle.

Ce qui ne demande aucune permission constitue la base de l'interface des extensions : lire le projet, le calendrier, les tâches, les relations, les ressources et les affectations ; ajouter des tâches et des relations, et modifier des tâches ; charger un projet, recalculer et regrouper plusieurs modifications ; conserver ses propres paramètres, lire ses propres fichiers intégrés et afficher une notification.

**Le manifeste.** Les permissions figurent dans le manifeste sous forme de liste. Une extension que vous installez maintenant, avec une permission que cette version de l'application ne connaît pas, est refusée. Pour une extension plus ancienne déjà enregistrée, l'application ignore les permissions inconnues et le signale dans le journal.

## Comment l'application demande

Lors de l'installation, depuis le catalogue (*Fichier › Extensions › Parcourir › Installer*) ou depuis un fichier (*ZIP* ou *JS*), l'application affiche la fenêtre *Installer l'extension ?*. La question n'apparaît qu'une fois, à l'installation : pas à chaque fois que vous activez l'extension.

La fenêtre affiche le nom, la version, la description, l'auteur et, s'il existe, le dépôt. Sous *Origine*, elle indique d'où vient l'extension (*Depuis le catalogue d'extensions en ligne*, *Depuis un fichier ZIP sur cet ordinateur* ou *Depuis un fichier JavaScript sur cet ordinateur*) et si le téléchargement a été vérifié : avec la somme de contrôle du catalogue, non vérifié parce que le catalogue n'en fournit pas, ou un fichier que vous avez choisi vous-même. Sous *Ce que vous acceptez*, elle indique qu'une extension est du code de programme qui s'exécute avec les mêmes droits que l'application, et ce que cela signifie concrètement : dans l'application de bureau, entre autres la lecture et l'écriture de fichiers n'importe où dans votre dossier utilisateur, ainsi que l'accès à vos projets, paramètres et presse-papiers ; dans le navigateur, l'accès à vos projets et paramètres enregistrés, aux fichiers auxquels vous avez donné accès et au réseau.

Sous *Ce que cette extension déclare utiliser*, figurent les permissions du manifeste, sous forme de courtes étiquettes, avec le nom tel que décrit ci-dessous. Elle affiche : *C'est la déclaration de l'auteur, pas une restriction — le code peut faire davantage.* Si l'extension n'a aucune permission, elle affiche *Rien de déclaré.* Deux permissions reçoivent une explication : *importSource* et *help*. Les six autres reçoivent seulement leur étiquette.

En cliquant sur *Installer*, vous acceptez. *Ne pas installer*, Échap et un clic en dehors de la fenêtre refusent l'installation.

## Les permissions

**ribbon** — placer un bouton dans le ruban. Effet : l'extension peut ajouter un bouton à un groupe d'un onglet de ruban. Une extension sans cette permission reçoit une erreur quand elle essaie. Les boutons apparaissent à la fin de l'onglet choisi, sous une étiquette de groupe de l'extension, et disparaissent quand vous désactivez ou supprimez l'extension. Par défaut : non accordée ; seulement ce qui figure dans le manifeste. Application : stricte. Où : sur l'onglet que l'extension a choisi.

**events** — suivre les événements de l'application et envoyer soi-même des événements. Effet : l'extension peut s'abonner à des événements, se désabonner et envoyer elle-même des événements. L'application en envoie quatre : un projet est chargé (après un import, une ouverture ou un chargement par une extension), un projet vide est créé, le planning est (re)calculé, et l'utilisateur demande un tutoriel. Ce dernier événement n'est envoyé qu'à l'extension tutoriel. Par défaut : non accordée ; seulement ce qui figure dans le manifeste. Application : stricte. Où : nulle part ; l'extension réagit à l'événement.

**backstage** — proposer un format d'import. Effet : l'extension peut enregistrer un importeur ; il apparaît dans *Fichier › Importer*, où vous cliquez sur un format et choisissez un fichier. Les formats intégrés sont distincts (voir [Formats d'import et d'export](docs://ref-import-exportformaten)). Par défaut : non accordée ; seulement ce qui figure dans le manifeste. Application : avertissement. Si la permission manque, l'enregistrement fonctionne quand même, avec un avertissement dans le journal. C'est une solution transitoire, car les extensions existantes ne déclarent pas toujours la permission. Où : *Fichier › Importer*.

**pdf-fonts** — fournir une police pour l'export PDF. Effet : l'extension peut enregistrer un fournisseur de polices. L'export PDF l'utilise pour les caractères que les polices intégrées ne couvrent pas, comme les caractères chinois, japonais et coréens. Par défaut : non accordée ; seulement ce qui figure dans le manifeste. Application : stricte. Où : dans le PDF d'un rapport ; dans la fenêtre d'installation, il n'y a que l'étiquette.

**importSource** — lire les octets d'origine d'un fichier importé. Effet : l'extension peut demander le contenu complet du fichier source d'un projet importé (pour l'instant : un fichier Primavera), y compris les champs que l'application ne reprend volontairement pas dans votre projet, comme les champs d'audit et de provenance, les coûts, les champs de révision et de localisation. Cela va bien plus loin que le reste de l'interface, c'est pourquoi c'est une permission distincte. Sans cette permission, l'application ne lit pas un seul octet du fichier source : chaque méthode lève alors une erreur avant que quoi que ce soit ne soit récupéré. Par défaut : non accordée ; seulement ce qui figure dans le manifeste. Application : stricte, refusée par défaut. Où : dans la fenêtre d'installation, une explication l'accompagne : *importSource — les octets source complets de chaque fichier importé (par exemple un fichier Primavera brut), y compris les champs qui n'atteignent jamais le projet.*

**help** — ajouter des articles d'aide et des conseils. Effet : l'extension peut enregistrer et retirer des articles d'aide (tutoriels), ouvrir un fichier `.ifc` fourni comme nouveau document, et démarrer et arrêter un guide qui désigne des parties de l'application. Un projet fourni n'écrase jamais le document sur lequel vous travaillez : il s'ouvre comme nouveau document, ou remplace seulement un onglet vide et non modifié. Depuis la version 1.4.0 du contrat. Par défaut : non accordée ; seulement ce qui figure dans le manifeste. Application : stricte. Où : dans la fenêtre *Aide* (les articles), comme nouvel onglet (le projet) et comme guide qui désigne des boutons. Dans la fenêtre d'installation, une explication l'accompagne : *help — peut ajouter des articles d’aide, ouvrir des projets fournis comme nouveau document et afficher un guide qui désigne des éléments de l’application.*

**filesystem** — l'extension déclare utiliser des fichiers. Effet : aucun ; aucune partie de l'interface n'y est liée, et l'application ne peut pas l'appliquer. Par défaut : non accordée ; seulement ce qui figure dans le manifeste. Application : informatif uniquement. Où : comme étiquette dans la fenêtre d'installation.

**network** — l'extension déclare utiliser le réseau. Effet : aucun ; comme *filesystem*. Par défaut : non accordée ; seulement ce qui figure dans le manifeste. Application : informatif uniquement. Où : comme étiquette dans la fenêtre d'installation.

## Voir aussi

- [Formats d'import et d'export](docs://ref-import-exportformaten) : les formats que l'application connaît elle-même, à côté de ce que les extensions ajoutent sous *Fichier › Importer*.
- [Installer et gérer une extension](docs://howto-extensie-installeren) : installer, désactiver et supprimer une extension.
