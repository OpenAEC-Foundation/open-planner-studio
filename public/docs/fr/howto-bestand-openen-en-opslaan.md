# Ouvrir et enregistrer un fichier

Objectif : ouvrir un projet depuis un fichier et conserver vos modifications.

## Quand vous en avez besoin

Vous commencez la journée avec le projet de la veille, vous recevez un fichier d'un collègue ou d'un autre logiciel, ou vous voulez conserver un état intermédiaire avant de modifier quelque chose d'important. Ce que l'application conserve dans un fichier, et pourquoi seul IFC conserve tout votre projet, est expliqué dans [Fichiers et formats](docs://uitleg-bestanden).

## Étapes

### Ouvrir un fichier

1. Choisissez *Accueil › Fichier › Ouvrir*, ou *Fichier › Ouvrir*, ou appuyez sur Ctrl+O (⌘+O sur un Mac). Le groupe *Fichier* se trouve aussi dans l'onglet *Tableau*.
2. Choisissez le fichier. Vous ouvrez un fichier à la fois. Sur le bureau et dans les navigateurs avec accès aux fichiers, comme Chrome et Edge, la fenêtre affiche une liste de types de fichiers : *Tous les formats pris en charge*, *Fichiers IFC*, *Fichiers CSV*, *Fichiers XML*, *Fichiers MS Project* et *Fichiers Primavera XER*.
3. Le projet s'ouvre dans un nouvel onglet. Si l'onglet actuel était encore vide et non modifié, le projet s'ouvre dans celui-ci.
4. Si le fichier n'est pas un fichier IFC, une fenêtre apparaît avec une courte explication de ce format. Un bloc vert indique ce que l'application a repris, un bloc orange ce qui n'est pas inclus ou seulement en partie, et un bloc bleu comment fonctionnent l'enregistrement et la réécriture. *En savoir plus* ouvre le guide de ce format. Cliquez sur *Compris* pour fermer la fenêtre. Cochez d'abord *Ne plus afficher pour …* si vous ne voulez plus voir cette explication pour ce format. Vous la réactivez dans les [Paramètres de l'application](docs://ref-instellingen), dans l'onglet *Avancé*.

Un fichier IFC donne son nom de fichier à l'onglet. Un projet issu d'un autre format reçoit le nom de son projet.

L'application ouvre `.ifc`, `.csv`, `.xml` (XML MS Project ou XML Primavera P6), `.mpp` et `.xer`. Pour les deux derniers, il existe des étapes séparées dans [Ouvrir un fichier MS Project (.mpp)](docs://howto-mpp-openen) et [Ouvrir un fichier Primavera P6 (.xer)](docs://howto-xer-openen).

### Ouvrir un projet récent

Choisissez *Accueil › Fichier › Récents* et cliquez sur un fichier de la liste, ou choisissez *Fichier › Récents*. La liste garde les dix derniers fichiers que vous avez ouverts, enregistrés ou exportés. Ici aussi, pour un fichier qui n'est pas IFC, l'explication de son format apparaît. L'application de bureau affiche le chemin de chaque fichier, un navigateur seulement le nom.

Si l'application ne peut plus lire un fichier de la liste, par exemple parce que vous l'avez déplacé, il disparaît de la liste sans message. Dans les navigateurs sans accès aux fichiers, comme Firefox, *Récents* reste vide.

### Ouvrir un exemple

Choisissez *Fichier › Exemples* et cliquez sur un projet d'exemple. Il s'ouvre dans un onglet, sans fichier : *Enregistrer* demande donc où vous voulez le conserver.

### Enregistrer

Choisissez *Accueil › Fichier › Enregistrer* ou *Fichier › Enregistrer*, ou appuyez sur Ctrl+S. Ce qui se passe ensuite dépend de votre projet :

1. Si le projet a déjà un fichier, parce que vous avez ouvert un fichier IFC ou l'avez enregistré avant, l'application écrit dans ce fichier. Aucune fenêtre n'apparaît, sauf lors du premier enregistrement d'un fichier dont le schéma IFC n'est pas IFC 4.3 ADD2. L'application demande alors d'abord *Dans quel schéma IFC enregistrer ?* Voir [Choisir le schéma IFC](docs://howto-ifc-schema-kiezen).
2. Si le projet n'a pas encore de fichier, l'application demande où le placer. Elle propose le nom du projet avec `.ifc`. Ensuite, ce fichier devient le fichier du projet.
3. Si votre navigateur enregistre seulement par un téléchargement (comme Firefox), le fichier arrive dans votre dossier de téléchargements, et chaque enregistrement crée un nouveau téléchargement. La première fois dans une session, vous voyez le message *Enregistré sous forme de téléchargement : « name.ifc » se trouve dans votre dossier de téléchargements. Ce navigateur ne permet pas à l'application d'écrire à un emplacement qui lui est propre, donc chaque enregistrement crée un nouveau téléchargement. Dans Chrome, Edge ou l'application de bureau, Enregistrer met simplement à jour le même fichier.*
4. Si votre navigateur ne peut pas réécrire dans le fichier du projet, l'application demande à nouveau où placer le fichier à chaque enregistrement. Cela ressemble à *Enregistrer sous*, mais c'est une limite du navigateur. La première fois dans une session, le message *Ce navigateur ne permet pas à l'application de réécrire dans « name.ifc ».* l'explique, avec un lien vers [Fichiers](docs://uitleg-bestanden).

Après l'enregistrement, le repère *Non enregistré* disparaît : le point sur l'onglet, l'astérisque devant le nom du projet en haut et le texte *Non enregistré* en bas à droite de la barre d'état.

### Enregistrer sous un autre nom

Choisissez *Accueil › Fichier › Enregistrer sous* ou *Fichier › Enregistrer sous*, ou appuyez sur Ctrl+Shift+S. Choisissez un nom et un emplacement (dans Firefox, l'application télécharge à la place un nouveau fichier). Ensuite, le projet travaille avec ce nouveau fichier : le prochain *Enregistrer* écrit à cet endroit. L'ancien fichier reste tel qu'il était la dernière fois que vous l'avez enregistré.

### Fermer un projet

Cliquez sur la croix de l'onglet, ou choisissez *Fichier › Fermer le projet*. Si le projet contient des modifications que vous n'avez pas enregistrées, l'application demande : *Modifications non enregistrées : « name » contient des modifications qui n'ont pas encore été enregistrées.* Vous choisissez *Annuler* (le projet reste ouvert), *Ne pas enregistrer* (le projet se ferme et vos modifications sont perdues) ou *Enregistrer* (enregistrer d'abord, puis fermer). Si vous fermez toute l'application sur le bureau (avec le bouton de fermeture, Alt+F4 ou le menu de votre système d'exploitation), elle pose cette question pour chaque projet avec des modifications ; *Annuler*, ou un enregistrement qui échoue, arrête la fermeture. Après une fermeture normale de ce type, l'application supprime les copies de récupération de cette session, donc la fenêtre de récupération n'apparaît qu'après un vrai plantage. Si un projet contient des modifications et que vous fermez l'onglet ou la fenêtre du navigateur, le navigateur demande une confirmation.

## Pièges et ce que fait alors l'application

**Un fichier IFC ouvert devient tout de suite le fichier de votre projet.** *Enregistrer* écrase ce fichier, même s'il vient d'un autre programme. Si vous voulez garder l'original, choisissez d'abord *Enregistrer sous*.

**Les autres formats ne sont jamais écrasés.** Un `.csv`, `.xml`, `.mpp` ou `.xer` n'a pas de fichier après son ouverture. *Enregistrer* écrit un nouveau fichier IFC et laisse l'original intact.

**Dans Firefox, chaque enregistrement crée un nouveau fichier.** L'application ne peut pas écrire dans votre fichier là-bas. Elle télécharge un nouveau fichier à chaque fois, avec le nom du projet comme nom de fichier, et non le nom du fichier que vous avez ouvert.

**Chrome et Edge demandent une autorisation.** Au premier *Enregistrer* d'un fichier que vous avez ouvert, le navigateur demande si l'application peut y écrire. Si vous refusez, l'application ouvre une fenêtre dans laquelle vous choisissez un nouveau fichier. Dans Chrome et Edge, vous obtenez aussi cette fenêtre si l'écriture dans le fichier existant échoue, par exemple parce que le fichier a disparu ou qu'il est verrouillé.

**Un message sur des identifiants en double ou sur des relations non prises en compte.** Après l'ouverture, un message peut rester à l'écran. S'il indique *Objets avec un identifiant en double dans ce fichier*, chaque objet en double reçoit son propre identifiant, et les références pointent vers la première occurrence. Vérifiez alors les relations et les affectations. S'il indique *relation(s) n'ont pas pu être incluses dans le calcul*, la relation se trouvait sur une tâche récapitulative et n'a aucun effet, par exemple une tâche liée à sa propre tâche récapitulative. Le fichier lui-même reste inchangé. Voir [Relations](docs://uitleg-relaties) pour savoir ce que fait une relation sur une tâche récapitulative.

**L'enregistrement peut échouer.** Si l'enregistrement lui-même donne une erreur, l'application affiche *Échec de l'enregistrement*, avec la raison. Votre projet reste ouvert et est toujours marqué *Non enregistré*.

## Voir aussi

- [Fichiers et formats](docs://uitleg-bestanden) : ce qu'il y a dans un fichier IFC et comment l'application traite les formats.
- [Activer l'enregistrement automatique](docs://howto-automatisch-opslaan) : laisser l'application mettre à jour votre fichier elle-même.
- [Choisir le schéma IFC](docs://howto-ifc-schema-kiezen) : ce que signifie la question *Dans quel schéma IFC enregistrer ?*
- [Exporter](docs://howto-exporteren) : faire une copie dans un autre format.
- [Récupérer après un plantage](docs://howto-herstellen-na-een-crash) : ce que vous faites si l'application ne s'est pas fermée correctement.
- [Formats d'import et d'export](docs://ref-import-exportformaten) : pour chaque format, ce qui est repris et ce qui ne l'est pas.
