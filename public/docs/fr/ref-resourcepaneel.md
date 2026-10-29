# Panneau des ressources

Le panneau des ressources sert à gérer les ressources : qui et quoi est disponible, avec quelle capacité et sur quel calendrier. L'histogramme sous le Gantt et la surallocation en font partie. Cet article décrit, pour chaque champ et chaque bouton, ce qu'il fait, quelle est la valeur par défaut et ce que vous remarquez. La création et l'affectation des ressources sont expliquées dans [Gérer les ressources](docs://howto-resources-beheren) et [Affecter des ressources avec une courbe](docs://howto-resource-toewijzen) ; la résolution de la surallocation est expliquée dans [Résoudre la surallocation](docs://howto-overbezetting-oplossen).

## Où le trouver

- **Panneau complet** — *Ressources › Gérer › Ressources* ou *Affichage › Panneaux › Ressources*. Il occupe tout l'espace de travail ; la croix en haut à droite le ferme.
- **Dock ressources** — *Ressources › Gérer › Dock ressources* ou *Affichage › Panneaux › Dock ressources* : une liste compacte dans la colonne de droite, à côté du Gantt. Voir ci-dessous.
- **Histogramme** — *Ressources › Histogramme › Histogramme* ou *Affichage › Panneaux › Histogramme* : une bande sous le Gantt. Voir ci-dessous.
- **Vues** — si votre projet appartient à une bibliothèque de ressources, la partie en haut à droite du panneau propose un choix entre *Bibliothèque*, *Projet* et *Occupation*. Sans bibliothèque de ressources, il n'y a que le tableau du projet. Chaque fois que vous l'ouvrez, le panneau démarre sur *Projet*, pour que vous n'arriviez pas sans le remarquer dans la bibliothèque de ressources partagée.

## Nouvelle ressource

- **Nouvelle ressource dans le projet** (dans la vue *Bibliothèque*, bouton *Nouvelle ressource dans la bibliothèque*) — bouton en haut à droite. Il ouvre une ligne provisoire en bas du tableau. Rien n'est créé tant que vous n'avez pas saisi un nom et quitté la ligne (ou appuyé sur Enter). Un clic en dehors d'une ligne vide, ou la touche Esc, ne laisse rien derrière : ni ressource, ni étape sous *Annuler*. Vous pouvez remplir les champs dans n'importe quel ordre ; tout est enregistré en une fois. Enter ou la flèche bas valide la ligne et ouvre une nouvelle ligne provisoire ; Shift+Enter ou la flèche haut la valide et revient dans le tableau. La ligne provisoire n'a pas la flèche de capacité, ni le crayon de calendrier, ni la corbeille, car ils agissent sur une ressource qui n'existe pas encore. Le bouton *Nouvelle ressource* de *Ressources › Gérer* fait la même chose.
- **Navigation dans la grille** — dans le tableau, Enter et Shift+Enter, ainsi que les flèches haut et bas, déplacent le curseur entre les lignes. Enter sur la dernière ligne ouvre une nouvelle ligne provisoire.

## La vue Projet

Le tableau de ce que ce projet utilise. Chaque ligne est une ressource. Les modifications de texte et de tarif prennent effet dès que vous quittez le champ et comptent comme une seule étape sous *Annuler*.

- **Couleur** — un sélecteur de couleur. Par défaut : la première couleur libre de la palette. Effet : la couleur de l'accent de ressource sous les barres du Gantt (*Affichage › Références et avancement › Accent ressource*) et de la pastille dans le dock.
- **Nom** — le nom de la ressource. Un nom vide n'est pas conservé ; le champ revient à l'ancien nom.
- **Type** — *Main-d'œuvre*, *Matériel*, *Matériau*, *Sous-traitant* ou *Équipe*. Par défaut pour une nouvelle ressource : *Main-d'œuvre*. Effet : *Matériau* a une *Unité* et ne compte pas dans la somme *Toutes les ressources* de l'histogramme ; le nivellement ignore le matériau. *Équipe* peut être choisie comme *Équipe* d'autres ressources. Les autres types se calculent de la même façon.
- **Unités max** — la part de la ressource disponible par jour, un nombre supérieur à 0 (les fractions sont acceptées). Par défaut : 1. Effet : la capacité par jour. Si la charge est plus élevée, la ressource est en surallocation. La flèche à côté déploie la *Capacité échelonnée dans le temps* ; le chiffre près de la flèche est le nombre d'étapes.
- **Capacité échelonnée dans le temps** — étapes avec *À partir de* (une date) et *Unités max*. *Ajouter une étape* ajoute une étape à la date du jour, avec 1. Sans étapes, il affiche *Aucune étape — les unités max. fixes s'appliquent toujours*. Effet : à partir de la date d'une étape, ses *Unités max* s'appliquent au lieu de la valeur fixe. Pour un jour donné, la dernière étape dont la date est égale ou antérieure à ce jour l'emporte.
- **Calendrier** — une liste avec *Calendrier du projet* (par défaut), les calendriers du projet et *+ Calendrier de ressource* pour un nouveau. Le crayon (*Modifier*…) ouvre le calendrier choisi et est désactivé pour *Calendrier du projet*. Effet : les jours où la ressource travaille. Un jour non travaillé, la capacité est de 0 ; si du travail y est planifié, la ressource est en surallocation avec la raison *Ne travaille pas ce jour selon le calendrier « … »*. Le calendrier de ressource ne modifie pas les dates d'une tâche. Voir [Fenêtres de calendrier](docs://ref-kalenders).
- **Tarif/heure** — le coût par heure. Vide = pas de tarif ; un nombre non valide revient à la valeur précédente. Effet : aucune influence sur le planning ni sur la charge. Le tarif détermine la colonne *Total*, est enregistré dans le fichier IFC et est repris à l'export vers MS Project (tarif standard) et vers le XML de Primavera P6 (prix par unité).
- **Total** — en lecture seule : les heures de charge × le tarif, avec deux décimales ; *—* sans tarif ni charge. En bas, une ligne *Total* additionne toutes les ressources. Les heures viennent du dernier calcul et comptent unités × heures par jour du calendrier de la tâche ; pas à jour ? Appuyez sur *Calculer*.
- **Unité** — l'unité de mesure du matériau, par exemple `m³`. Ce champ n'est modifiable que pour le type *Matériau* (info-bulle *À renseigner uniquement pour les ressources de type Matériau*). Effet : une étiquette ; elle ne calcule rien.
- **Équipe** — l'équipe à laquelle la ressource appartient, parmi les ressources de type *Équipe*. Par défaut : *Aucune*. Effet : regroupement seulement ; la capacité et la charge d'une équipe ne sont pas la somme de ses membres.
- **Supprimer** (la corbeille) — supprime la ressource. Si elle a des affectations, l'application demande d'abord *« … » a … affectation(s) — supprimer ?*, avec une coche pour confirmer et une croix pour annuler.
- **Vers la bibliothèque** — seulement si le projet appartient à une bibliothèque de ressources, et pour une ressource dont le nom ne vient pas encore de la bibliothèque. Elle place la ressource dans la bibliothèque de ressources, ou la lie à un élément existant portant le même nom, et indique le résultat (*Ajouté*, *Existait déjà dans la bibliothèque — désormais lié* ou *Lié à l'élément existant de la bibliothèque — les valeurs diffèrent, voir le repère*).
- **Dissocier de la bibliothèque** — l'icône de dissociation sur une ressource qui provient de la bibliothèque de ressources. Elle supprime l'origine ; ensuite, tous les champs sont à nouveau libres.

Sans ressource, il affiche *Aucune ressource pour l’instant. Ajoutez-en une pour commencer*. Si le projet appartient à une bibliothèque de ressources, il affiche *Ce projet n'utilise pas encore de ressources de la bibliothèque*, avec une indication.

### Ressources de la bibliothèque

Une ressource qui provient de la bibliothèque de ressources porte une petite icône de bibliothèque (*Provient de la bibliothèque*). Son *Nom*, son *Type*, son *Tarif/heure* et son *Unité* sont alors du texte simple (*Valeur de bibliothèque — modifiez-la dans la vue Bibliothèque, ou dissociez cette ressource de la bibliothèque*), parce que la bibliothèque de ressources décide ce qu'est la ressource. *Couleur*, *Unités max*, les étapes de capacité, *Calendrier* et *Équipe* restent modifiables, parce que le projet décide combien et quand. Deux badges peuvent apparaître : *diffère — à décider* (un clic ouvre la fenêtre *Lier la bibliothèque de ressources*) et *n'est plus dans la bibliothèque*, avec le bouton *Retirer du projet*.

## La vue Bibliothèque

Uniquement lorsque le projet appartient à une bibliothèque de ressources. Voir [Utiliser la bibliothèque de ressources](docs://howto-resourcebibliotheek-gebruiken) et [Gérer et partager les bibliothèques de ressources](docs://howto-bibliotheken-beheren). En haut se trouve un avis coloré : *Ceci modifie la bibliothèque et s'applique à tous les projets — hors annulation*. Le tableau a les mêmes champs que la vue *Projet*, avec ces différences :

- Il n'y a pas de colonne *Total* : c'est un calcul pour un seul projet.
- La colonne *Équipe* est présente dès que la bibliothèque de ressources contient des ressources.
- La colonne *Calendrier* propose les calendriers de la bibliothèque, avec *Aucun calendrier* par défaut.
- **Affecter au projet** — place la ressource dans le projet, avec une copie de son calendrier. Indique *Ajouté* ou *Déjà présent dans le projet*.
- **Supprimer** — demande *Supprimer « … » de la bibliothèque ? Cela s'applique à tous les projets et est irréversible*.
- Sans ressource, il affiche *Pas encore de ressources dans le pool*.

## La vue Occupation

Une vue en lecture seule sur tous les documents ouverts : quelles ressources de la bibliothèque sont réservées où. Il n'y a pas de bouton pour une nouvelle ressource. Voir [Utiliser l'aperçu d'occupation](docs://howto-bezettingsoverzicht-gebruiken).

- **Tableau** — par ressource de la bibliothèque : *Nom*, *Documents* (le nombre de documents dans lesquels elle figure), *Période* et *Pic / Capacité* (la charge combinée la plus élevée par rapport à la capacité ce jour-là). Le libellé rouge *N jours réservés en double* signifie que, sur plusieurs documents, la ressource dépasse sa capacité. La flèche à côté d'un nom déploie les documents, chacun avec sa période et son pic ; un clic sur une ligne affiche l'histogramme de cette ressource (*Sélectionnez une ressource pour voir l'histogramme*).
- **Ce qui compte** — seuls les documents ouverts dans cette application (*Cet aperçu ne voit que les documents ouverts dans cette application*). Un document qui n'a pas été calculé reçoit un message sur sa ligne. Le document actif compte avec ses derniers chiffres calculés (*Obsolète : ce sont les derniers chiffres calculés — appuyez sur F5 dans ce document*). Un autre document est calculé à l'avance par l'aperçu (*Calculé à l'avance pour cet aperçu — le document lui-même affiche encore d'anciennes dates jusqu'à ce que vous appuyiez sur F5 ou activiez « Calculer automatiquement »*) ; si *Calculer automatiquement* est activé, l'aperçu calcule réellement ces documents. Si le calcul échoue, le document ne compte pas (*Non compté : planification non calculée — activez ce document et appuyez sur F5*). Sans ressource de la bibliothèque réservée, il affiche *Aucune ressource de la bibliothèque n'est réservée dans les documents ouverts*.
- **Ordre** — les ressources avec des doubles réservations sont en haut, celles avec le plus de jours en conflit d'abord, puis par ordre alphabétique.

## Le dock ressources

Une liste compacte dans la colonne de droite, à côté du panneau *Propriétés*. Par ressource : une pastille de couleur, le nom (en lecture seule), un triangle rouge *Surchargé* dès que la ressource a au moins un jour en surallocation, et *Unités max* à modifier. S'il y a une sélection de tâches, seules les ressources de ces tâches sont listées. Dans l'en-tête se trouvent *Panneau complet* (ouvre le panneau complet) et *Fermer l'ancrage*. Sans ressource, il affiche *Aucune ressource pour l’instant. Ajoutez-en une pour commencer*.

## L'histogramme

Une bande sous le Gantt qui affiche la charge d'une ressource par jour. Activez-la ou désactivez-la avec *Ressources › Histogramme › Histogramme* ou *Affichage › Panneaux › Histogramme*. Par défaut : désactivée ; votre choix est mémorisé. La hauteur est de 160 pixels par défaut et peut être modifiée en faisant glisser le bord entre le Gantt et l'histogramme.

- **Sélecteur** — à gauche, sous le tableau des tâches, se trouve une liste : la ligne *Toutes les ressources* est épinglée en haut, suivie d'une ligne par ressource. Un clic choisit la ligne, les flèches du clavier la parcourent, et *Ressources › Histogramme › Précédent* et *Suivant* font de même. Un point rouge à côté d'une ligne signifie que cette ressource a au moins un jour en surallocation ; pour *Toutes les ressources*, le point ne tient compte que des ressources qui ne sont pas de type Matériau. S'il y a une sélection de tâches, la liste ne contient que les ressources de ces tâches ; si la ressource choisie n'en fait pas partie, la bande affiche temporairement *Toutes les ressources* de la sélection.
- **Barres** — une barre par jour : la charge en unités. Une ligne montre la capacité ; la partie de la barre au-dessus de la capacité est rouge. En haut à gauche se trouve la valeur la plus haute, avec *unités*. *Toutes les ressources* additionne la charge et la capacité de toutes les ressources, sauf le matériau.
- **Info-bulle** — gardez la souris immobile un moment sur un jour : *N tâches contribuent le {date}*, avec les noms de huit tâches au maximum. Pour une ressource choisie et un jour où son calendrier ne travaille pas, il affiche aussi *Ne travaille pas ce jour selon le calendrier « … »*.
- **Messages dans la bande** — *Recalculer (F5) pour afficher la charge* tant qu'il n'y a pas de charge, *Aucune ressource pour l’instant* sans ressources, et *⚠ Planning obsolète — recalculer (F5)* en haut à droite lorsque le planning n'est plus à jour.
- **Ce qui compte** — les unités par jour de chaque affectation, réparties sur les jours ouvrés de la tâche selon la *Courbe* (ou la *Répartition des heures*) ; seulement les tâches feuilles, sans jalons. La charge est actualisée après *Calculer* et après des modifications des ressources et des affectations ; si vous modifiez les dates des tâches, cela ne compte qu'après *Calculer*.

## Surallocation

Une ressource est en surallocation un jour si sa charge est plus élevée que sa capacité. La capacité est *Unités max* (avec les étapes de capacité) un jour ouvré de son calendrier, et 0 un jour non travaillé. Ici, le matériau compte aussi. La raison est soit une capacité trop faible, soit un jour où la ressource ne travaille pas selon son calendrier.

Où la voir :

- **Ressources › Surallocation** — le nombre de ressources en surallocation, ou *Aucune*.
- **Barre d'état** — *N ressource(s) en surallocation* ; un clic ouvre le panneau *Avertissements*.
- **Avertissements** — une ligne par ressource *Surallocation sur N jour(s) (premier – dernier)*, avec *la ressource ne travaille pas ces jours selon son calendrier* ajouté si tous les jours sont des jours non travaillés, ou *dont N jour(s) où la ressource ne travaille pas selon son calendrier* en cas de mélange. Voir [Notifications et avertissements](docs://ref-meldingen).
- **Histogramme** — les parties rouges des barres et le point rouge dans le sélecteur.
- **Dock** — le triangle *Surchargé*.

Le nivellement peut résoudre la surallocation en faisant commencer des tâches plus tard. Par défaut, la fin du projet peut être repoussée ; avec *lissage*, elle reste dans la marge. Le nivellement ne résout pas une ressource qui doit travailler un jour non travaillé. Voir [Nivellement](docs://uitleg-nivelleren).
