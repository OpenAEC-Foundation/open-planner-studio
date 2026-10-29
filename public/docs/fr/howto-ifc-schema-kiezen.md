# Choisir le schéma IFC

Objectif : enregistrez votre planning dans le schéma IFC du modèle de bâtiment avec lequel vous voulez le fusionner.

## Quand en avez-vous besoin

Par défaut, l'application enregistre un projet en IFC 4.3 ADD2. C'est le nom d'IFC 4.3 dans les fichiers que créent IfcOpenShell et Bonsai. Si vous voulez fusionner le planning avec un modèle de bâtiment dans un seul fichier 4D, par exemple avec la recette *MergeProjects* d'IfcOpenShell (ifcpatch), les deux fichiers doivent avoir le même schéma. Si le modèle de bâtiment est un fichier IFC4, IfcOpenShell refuse de le fusionner avec un planning en IFC 4.3. Choisissez alors ici le schéma du modèle.

## Étapes

1. Ouvrez *Paramètres du projet* : *Paramètres › Projet › Paramètres du projet*, ou *Fichier › Paramètres du projet*.
2. Sous *Schéma IFC à l'enregistrement*, choisissez le schéma de votre modèle de bâtiment.
3. Cliquez sur *Appliquer*. Le projet est maintenant *Non enregistré*.
4. Enregistrez avec *Enregistrer* (Ctrl+S) ou *Enregistrer sous*.

Les trois choix :

- *IFC 4.3 ADD2 (par défaut)* écrit `IFC4X3_ADD2` dans l'en-tête du fichier.
- *IFC 4.3* écrit `IFC4X3`. C'est la manière dont les anciennes versions de l'application écrivaient IFC 4.3.
- *IFC4* écrit `IFC4`, pour un modèle de bâtiment en IFC4.

## Pièges et comportement de l'application

**Fusionner en dernière étape.** N'ouvrez pas le fichier 4D fusionné (modèle de bâtiment plus planning) dans l'application pour l'enregistrer à nouveau. L'application ne garde que le planning : les murs et les autres parties du modèle de bâtiment sont perdus, même si vous conservez le schéma. Modifiez le planning dans votre propre fichier, puis fusionnez de nouveau.

**L'application pose d'abord une question si un fichier ouvert a un autre schéma.** Si vous ouvrez, par exemple, un fichier IFC4, ou un fichier IFC 4.3 d'une version plus ancienne de l'application, l'application ne change pas simplement le type du fichier. La première fois que vous utilisez *Enregistrer* ou *Enregistrer sous*, elle demande d'abord si vous conservez le schéma du fichier ou si vous passez à IFC 4.3 ADD2. *Conserver IFC4* (ou *Conserver IFC 4.3*) est le bouton que choisit la touche Entrée. Si vous fermez la question avec Échap ou la croix, l'application n'enregistre rien.

**L'application ne pose la question qu'une fois par fichier.** Votre choix est enregistré dans le fichier lui-même. Si vous l'ouvrez de nouveau plus tard, l'application ne pose plus la question. Si vous choisissez vous-même un schéma dans *Paramètres du projet* et cliquez sur *Appliquer*, l'application ne pose pas non plus la question.

**Un schéma que l'application ne peut pas écrire**, comme IFC2X3, s'ouvre dans l'application. La première fois que vous enregistrez, la question l'indique, et vous choisissez l'un des trois schémas ci-dessus.

**L'enregistrement automatique et la récupération après un plantage ne posent aucune question.** Ils écrivent le schéma du fichier et gardent la question pour la première fois que vous enregistrez vous-même. Pour un schéma que l'application ne peut pas écrire, *Enregistrement automatique* n'écrit pas dans le fichier tant que vous n'avez pas répondu à la question.

**Un nouveau projet ne pose aucune question.** Un nouveau projet, et un projet d'un autre format comme XER, MPP ou CSV, démarre avec *IFC 4.3 ADD2 (par défaut)*.

**Le contenu du fichier ne change pas.** Les trois schémas connaissent les données de planification que l'application écrit de la même façon. Seule la ligne `FILE_SCHEMA` de l'en-tête diffère. Vous ne perdez donc rien lorsque vous choisissez un autre schéma.

**Un modèle IFC 4.3 d'IfcOpenShell ou de Bonsai** a en général `IFC4X3_ADD2` dans l'en-tête, comme la valeur par défaut de l'application. IfcOpenShell ne fusionne pas dans ce modèle un planning en `IFC4X3`. En cas de doute, regardez la ligne `FILE_SCHEMA` en haut du fichier du modèle.

**Annuler ne change pas le schéma.** Le schéma appartient au fichier, comme l'endroit où il est enregistré. Un choix dans *Paramètres du projet* et la réponse à la question lors de l'enregistrement ne sont donc pas une étape d'*Annuler*. Pour revenir en arrière, choisissez l'autre schéma dans *Paramètres du projet*. Ainsi, l'*Enregistrement automatique* n'écrit jamais en silence un autre schéma après que vous avez annulé une modification.

## Voir aussi

- [Nouveau projet et Paramètres du projet](docs://ref-projectinfo) : tous les champs du formulaire.
- [Fichiers et formats](docs://uitleg-bestanden) : pourquoi IFC est le format propre de l'application.
- [Ouvrir et enregistrer un fichier](docs://howto-bestand-openen-en-opslaan) : enregistrer et enregistrer sous.
