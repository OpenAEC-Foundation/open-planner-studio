# Raccourcis clavier & manipulation

Ce guide ne dresse pas la liste des raccourcis clavier — cette liste existe déjà à un seul endroit, et une copie ici deviendrait immédiatement obsolète. Il explique plutôt **comment toujours afficher la liste actuelle**, et quels concepts de manipulation (menus contextuels, glisser-déposer, sélection par rectangle contre panoramique, zoom) méritent d'être compris par eux-mêmes.

## Ce que vous allez apprendre ici

- Comment ouvrir l'aperçu des raccourcis toujours à jour.
- Ce que contient chacun des quatre menus contextuels dans la vue Gantt.
- Comment fonctionne le glisser-déposer : déplacer une barre contre tracer une relation.
- Quand un glissement sur une zone vide fait défiler la vue (panoramique), et quand il sélectionne par rectangle.
- Le zoom, les onglets de document et le mode présentation.
- Comment relancer la visite guidée.

## L'aperçu toujours à jour

Appuyez sur **Ctrl+/** (ou **Cmd+/** sur macOS) pour ouvrir l'aperçu des raccourcis — la même fenêtre est aussi accessible via le bouton **Raccourcis** de l'onglet de ruban **Affichage**. Cette fenêtre est en lecture seule et est construite directement à partir du code source de l'application : un nouveau raccourci y apparaît automatiquement, sans liste séparée que quelqu'un doive maintenir synchronisée. C'est exactement pourquoi ce guide ne duplique pas la liste — une seconde liste tenue à la main finirait tôt ou tard par diverger de ce que fait réellement l'application. La fenêtre regroupe les raccourcis par catégorie : Fichier, Édition, Structure, Affichage et Navigation.

## Menus contextuels : quatre types, selon l'endroit où vous cliquez avec le bouton droit

Cliquer avec le bouton droit dans la vue Gantt donne un menu différent selon où se trouve la souris :

- **Sur une barre de tâche** — le menu de tâche complet (éditer, insérer, ajouter une sous-tâche/un jalon/une relation, attribuer un calendrier, avancement, priorité, tracer le chemin, supprimer…), plus un élément supplémentaire spécifique à la barre en haut : **Démarrer une relation à partir d'ici**.
- **Sur une ligne de tâche sans toucher de barre** (par exemple une ligne sans barre actuellement visible) — le même menu de tâche, mais sans l'élément spécifique à la barre.
- **Sur une ligne d'en-tête de groupe** (la ligne qui résume un ensemble de tâches groupées) — un petit menu pour réduire/développer ce groupe précis, plus **Tout développer**/**Tout réduire** pour l'arborescence entière.
- **Sur une zone vide du canevas** (aucune tâche, aucun en-tête de groupe) — **Nouvelle tâche**, **Ajouter un jalon**, **Coller** (s'il y a quelque chose dans le presse-papiers), **Réinitialiser le zoom** et **Ajuster au projet**.

Ce dernier menu a été vérifié en direct : un clic droit sur un emplacement vide du canevas du Gantt produit exactement ces cinq éléments, dans cet ordre.

## Glisser-déposer sur une barre de tâche

Saisir et faire glisser une barre de tâche déplace la tâche (ou, en saisissant le bord, modifie sa durée). Maintenez **Maj** enfoncée en faisant glisser depuis une barre, et vous commencez à la place à tracer une **relation** vers la tâche sur laquelle vous relâchez — la même chose que **Démarrer une relation à partir d'ici** dans le menu contextuel de la barre, mais en un seul mouvement de souris.

## Panoramique contre sélection par rectangle

Un glissement qui démarre sur un espace vide fait l'une de deux choses, selon où vous le démarrez et selon votre mode de défilement (**Paramètres → Défilement & zoom**) :

- **Dans le tableau des tâches** (la colonne de gauche avec WBS/nom/durée), un glissement sur un espace vide est **toujours** une sélection par rectangle — le panoramique n'y a jamais lieu.
- **Dans le canevas du Gantt lui-même** : si votre mode de défilement est réglé sur **Glisser** (panoramique façon carte), le panoramique l'emporte — exactement comme on l'attendrait d'une application de carte. Avec l'un des autres modes de défilement (**Position** ou **Mappage des touches**), ce même glissement sur un canevas vide est une sélection par rectangle, vous permettant de sélectionner plusieurs tâches à la fois en faisant glisser un rectangle autour d'elles.

En bref : le tableau des tâches sélectionne toujours ; le canevas ne fait un panoramique qu'en mode de défilement Glisser et sélectionne dans les autres cas.

## Zoom

Outre les boutons de zoom sur le ruban, **+**/**=** (ou **Ctrl+=**) effectue un zoom avant et **-** (ou **Ctrl+-**) un zoom arrière. Un simple **0** réinitialise le zoom à la valeur par défaut ; **Ctrl+0** ajuste le zoom pour que tout le projet tienne à l'écran (« ajuster au projet ») — la même chose que le bouton de ce nom dans le menu contextuel du canevas vide ci-dessus.

## Onglets de document

Si vous avez plusieurs projets ouverts à la fois (chacun dans son propre onglet de document), **Ctrl+1** à **Ctrl+9** passent directement au premier jusqu'au neuvième onglet de document.

## Mode présentation

**F11** bascule le mode présentation — une vue plein écran sans le ruban ni les panneaux latéraux, destinée à afficher le planning sans les éléments d'édition qui l'entourent. **Échap** quitte de nouveau le mode présentation (et, à une pression suivante, effectue le « désélectionner » habituel).

## Relancer la visite guidée

Vous voulez relancer la visite guidée d'introduction (par exemple pour montrer l'application à quelqu'un d'autre) ? Il y a deux endroits pour cela : le bouton **Visite guidée** de l'onglet de ruban **Affichage**, ou **Démarrer la visite guidée** dans la navigation Backstage (la ligne juste au-dessus de Paramètres). Les deux démarrent immédiatement la visite, sans afficher d'abord la boîte de dialogue de bienvenue.

## Poursuivre la lecture

- Ouvrez vous-même l'aperçu des raccourcis avec **Ctrl+/** — c'est la source de référence, pas ce guide.
- Le comportement de défilement et de zoom se configure sous **Paramètres → Défilement & zoom**, disponible aux trois emplacements fixes de paramètres de l'application (l'icône d'engrenage, l'onglet de ruban Paramètres, et Backstage → Paramètres).
