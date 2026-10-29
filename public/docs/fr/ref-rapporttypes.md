# Types de rapports

Chaque rapport de l'onglet *Rapport*, avec les options qui lui appartiennent : ce qu'elles font, la valeur de départ, ce qui change dans le rapport et où vous les trouvez. Comment créer un rapport et l'enregistrer en PDF est expliqué dans [Créer et imprimer un rapport](docs://howto-rapport-maken-en-afdrukken).

## Fonctionnement de la fenêtre de rapport

Ouvrez l'onglet *Rapport* (ou appuyez sur Ctrl+P). À gauche se trouve la colonne *Rapport*, avec la liste déroulante *Type de rapport*, le bloc *Résumé* avec des compteurs, le bloc *Paramètres* ou *Options du rapport* et, en bas, le bouton *Exporter en PDF*. À droite se trouve l'aperçu. Ce que vous voyez dans l'aperçu se retrouve dans le PDF.

**Type de rapport** — quel rapport vous voyez. Choisissez parmi onze rapports. Par défaut : *Diagramme de Gantt*. Où : *Rapport*, en haut de la colonne *Rapport*.

**Exporter en PDF** — crée le PDF. Effet : le résultat est seulement un PDF ; l'application n'envoie rien à une imprimante. Si le planning n'est plus à jour, l'application calcule d'abord. Si le calcul donne une erreur, par exemple à cause d'une boucle dans les relations, le bouton ne crée aucun fichier et affiche l'erreur. Où : *Rapport*, en bas de la colonne *Rapport*.

**Mémorisé.** L'application conserve toutes les options de rapport sur cet appareil, pour tous vos projets. Elles n'appartiennent pas au fichier du projet. Seul le champ *Entreprise* du diagramme de Gantt n'est pas conservé.

**Planning actuel.** Les rapports utilisent le dernier calcul. Si le planning a changé depuis, les rapports de tableau affichent en haut *Le planning a changé depuis le dernier calcul — appuyez sur Calculer (F5) pour des valeurs à jour.* Si rien n'a jamais été calculé, il est écrit *Pas encore calculé — appuyez sur Calculer (F5) pour les dates et les marges.* Si le projet est dans la vue *Dates telles qu'enregistrées*, les rapports affichent les dates du fichier source et une bande le signale.

**Abréviations.** *jo* signifie jours ouvrés. *MT* (TF) est la marge totale, *ML* (FF) la marge libre.

## Papier et orientation

**Papier :** — le format de papier du PDF. Choisissez parmi A4, A3, A2 et A1. Par défaut : A3. Effet : les pages sont mises en page pour ce format. Il existe un seul choix pour tous les rapports : ce que vous choisissez pour un rapport vaut aussi pour les autres. En A4 portrait, un tableau large devient petit, car le tableau est adapté à la largeur de la page. Où : *Paramètres* (Diagramme de Gantt et Diagramme des ressources) ou *Options du rapport* (les sept rapports de tableau). La vue d'ensemble des jalons et l'écart n'affichent aucun choix.

**Orientation :** — paysage ou portrait. Choisissez parmi *Paysage* et *Portrait*. Par défaut : *Paysage*. Effet : comme pour *Papier*. Où : au même endroit que *Papier*.

## Diagramme de Gantt

Le planning sous forme de diagramme à barres, avec un tableau à gauche et une frise chronologique à droite, sur plusieurs pages si nécessaire. L'aperçu montre la feuille avec l'en-tête de page, le tableau, la frise chronologique et la légende. Le bloc *Résumé* compte *Tâches*, *Tâches feuilles*, *Critique* et *Relations*. Toutes les options se trouvent sous *Paramètres*.

**Entreprise :** — l'entreprise dans l'en-tête de page. Par défaut : l'entreprise des paramètres du projet. Effet : seulement l'en-tête du rapport ; ce que vous saisissez ici n'est pas conservé. Modifiez l'entreprise dans *Paramètres › Projet › Paramètres du projet*, dans le champ *Client/organisation*, et confirmez avec *Appliquer*.

**Auteur :** — l'auteur dans l'en-tête de page. Lecture seule : l'application le prend dans les paramètres du projet.

**Taille de la police :** — taille du texte et du tableau dans le rapport. Choisissez parmi 90%, 100%, 110% et 125%. Par défaut : 100%. Effet : avec une police plus grande, le texte, les lignes et le tableau grandissent, et la frise perd de la largeur. Indépendante de *Taille du texte* dans les paramètres.

**Couleurs des barres :** — ce dont dépend la couleur d'une barre. Choisissez parmi *Chemin critique*, *Par tâche — automatique* et *Par catégorie*, avec une liste déroulante *Champ de catégorie* pour *Par catégorie*. Par défaut : *Chemin critique*. Effet : c'est le même choix que *Couleurs des barres* de l'onglet *Affichage* : si vous le changez ici, le diagramme de Gantt à l'écran change aussi. Si le champ choisi n'existe pas dans ce projet, il est écrit *Ce champ n’existe pas dans ce projet. La catégorie de travaux est utilisée temporairement.*

**Ligne d'état :** — une ligne à la date d’état. Choisissez parmi *Aucune*, *Ligne de date d’état* et *Ligne d’avancement*. Par défaut : *Aucune*. Effet : *Ligne de date d’état* trace une ligne à la date d’état ; *Ligne d’avancement* trace la ligne en zigzag qui se gonfle selon l'avancement de chaque tâche. Si le projet n'a pas de date d'état, il est écrit *Définissez d’abord une date d’état* et le rapport ne trace rien.

**Suivre la vue (filtre, groupe, tri)** — seulement pour le diagramme de Gantt. Par défaut : désactivé. Effet : désactivé, l'arbre complet des tâches est imprimé. Activé, seules les lignes de l'écran sont imprimées, avec votre filtre, votre groupement, votre tri et les phases repliées.

**Ajustement automatique au papier** — adapte la frise à la largeur de la page. Par défaut : activé. Effet : activé, la frise est adaptée à la largeur de la page ; le nombre de pages dépend de la hauteur. Désactivé, une échelle fixe est utilisée (*Zoom :*) et la frise est aussi répartie sur la largeur, ce qui donne vite beaucoup de pages.

**Zoom :** — l'échelle fixe de la frise. Visible seulement quand *Ajustement automatique au papier* est désactivé. Curseur de 1 à 40. Par défaut : 22. Effet : une valeur plus grande élargit la frise, donc davantage de pages en largeur.

**Frise répartie sur :** — répartit la frise sur plusieurs largeurs de page. Choix de 1 à 8 pages. Par défaut : 1 page. Effet : seulement avec *Ajustement automatique au papier* ; sinon le choix est désactivé et il est écrit *Uniquement avec ajustement automatique*. Pratique pour un long planning que vous voulez imprimer en taille lisible.

**En-tête sur chaque page** — Par défaut : activé. Effet : activé, l'en-tête de page figure sur chaque page ; désactivé, seulement sur la première.

**Pied de page sur chaque page** — Par défaut : activé. Effet : activé, le pied de page (nom du projet, date d'impression et légende) figure sur chaque page ; désactivé, seulement sur la dernière. Un document sans légende est illisible, d'où l'option activée par défaut.

**Noms des tâches sur les barres** — Par défaut : activé. Effet : le nom de la tâche sur la barre, s'il y a de la place.

**Afficher l'avancement** — Par défaut : activé. Effet : la partie terminée de la barre devient grise, comme dans le diagramme de Gantt, et la colonne *Avanc* apparaît dans le tableau. Une tâche terminée n'a pas de bande de marge.

**Tronquer les noms de tâches** — Par défaut : activé. Effet : activé, les noms du tableau sont coupés à la largeur de *Colonne nom*. Désactivé, la colonne s'élargit avec le nom le plus long ; il est alors écrit *La colonne des noms s'adapte au nom de tâche le plus long*.

**Colonne nom :** — la largeur de la colonne des noms. Visible seulement quand *Tronquer les noms de tâches* est activé. Curseur de 60 à 400. Par défaut : 130.

**Afficher la superposition de référence** — la référence active à côté des barres. Par défaut : désactivé. Effet : une fine barre dans la couleur de la référence, sous la barre de la tâche, seulement pour les tâches qui figurent dans la référence.

**Chemin critique** — Par défaut : activé. Effet : règle seulement les lignes de relation rouges entre deux tâches critiques et la ligne de la légende. Les barres suivent *Couleurs des barres*, quelle que soit cette case à cocher.

**Afficher la marge** — Par défaut : activé. Effet : la marge sous forme de bande derrière les barres non critiques.

**Relations** — les lignes de relation. Par défaut : activé. Effet : trace des flèches entre les barres.

**Afficher uniquement les jours ouvrables** — compresse l'axe de la frise dans ce rapport. Par défaut : désactivé. Effet : les week-ends et les jours fériés sont sautés, et des bandes de semaine remplacent alors l'ombrage des week-ends. Indépendant du même réglage pour le diagramme de Gantt à l'écran.

**Week-ends** — Par défaut : activé. Effet : ombre les week-ends et les jours fériés dans la frise, tant que l'échelle permet de distinguer les jours. Sur l'axe compressé (*Afficher uniquement les jours ouvrables*), cette case n'a aucun effet.

**Légende** — Par défaut : activé. Effet : la légende dans le pied de page.

**Qualité de l'aperçu** — la netteté de l'aperçu. Choisissez parmi *Standard*, *Haute* et *Maximale*. Par défaut : *Haute*. Effet : seulement la netteté de l'aperçu à l'écran ; le PDF ne change pas. Où : *Rapport*, au-dessus de l'aperçu.

## Diagramme des ressources

Les mêmes barres que le diagramme de Gantt, regroupées par ressource : qui fait quoi et quand. Le bloc *Résumé* compte *Ressources*, *Affectations* et *Sans ressource* (avec une période, aussi *Hors période*). Le diagramme partage toutes les options du diagramme de Gantt, sauf *Suivre la vue (filtre, groupe, tri)*, *Chemin critique* et *Dépendances* : les lignes ne viennent pas de l'écran, une tâche peut apparaître sous plusieurs ressources, et les relations n'y sont pas tracées. La case *Chemin critique* est masquée et activée. Ces options s'ajoutent aux options du diagramme de Gantt sous *Paramètres*, avec ces quatre cases à cocher et la période :

**Chaque ressource sur une nouvelle page** — Par défaut : désactivé. Effet : chaque ressource commence sur une nouvelle page, pour distribuer une feuille par équipe ou par employé. Désactivé, on obtient un seul document continu.

**Inclure les tâches sans ressource** — Par défaut : désactivé. Effet : les tâches sans ressource apparaissent comme dernière bande du diagramme, pour voir ce qui n'a encore aucune ressource.

**Grouper par type de ressource** — Par défaut : désactivé. Effet : un niveau supplémentaire : d'abord une bande par type de ressource (main-d'œuvre, équipe, sous-traitant, équipement, matériel), et à l'intérieur de chaque type une bande par ressource.

**Afficher unités/jour et courbe** — Par défaut : activé. Effet : deux colonnes après le nom de la tâche, avec les unités par jour et la courbe de répartition de la ressource de cette bande. S'il y a trop peu de place pour la frise, le rapport omet les colonnes et il est écrit *Les colonnes Unités/j et Courbe ont été omises : …* ; plus de place vient d'un format de papier plus grand ou du paysage, d'une taille de police plus petite ou d'un tableau plus étroit.

**Période de rapport :** — seulement les tâches qui touchent la période. Par défaut : *Tout le projet*. Effet : l'axe du temps couvre exactement la période. S'il n'y a rien dans la période, il est écrit *Aucune tâche dans la période de rapport — choisissez une autre période ou Projet entier.* Voir *Période de rapport* plus bas.

## Vue d'ensemble des jalons

Tous les jalons du projet, dans un tableau. Pas d'options propres. Le bloc *Résumé* compte *Jalons*, *Obligatoires* et *En retard*. Les colonnes sont *WBS*, *Nom*, *Type* (*Automatique*, *Début* ou *Fin*), *Date*, *Contrainte/échéance*, *Marge*, *Obligatoire* et *État*. L'état est *En retard* si la contrainte n'est pas respectée, si l'échéance est dépassée ou si la marge totale est négative ; sinon *Critique* si le jalon est critique selon la définition de critique du projet ; sinon *Dans les délais*. Sans jalons, il est écrit *Aucun jalon dans ce projet.* Le PDF utilise le papier et l'orientation que vous avez choisis en dernier pour un autre rapport.

## Écart

Le planning actuel à côté de la référence active, pour les tâches feuilles. Pas d'options propres. Le bloc *Résumé* compte *Tâches*, *Plus tard* et *Plus tôt*, et affiche *Fin de projet : +3 jours ouvrés* (la différence en jours ouvrés entre la fin de la référence et la fin actuelle). Les colonnes sont *WBS*, *Nom*, *Début de la référence*, *Fin de la référence*, *Début actuel*, *Fin actuelle*, *Δ début (jo)*, *Δ fin (jo)* et *État*. L'état suit la fin : *Plus tard* si la fin est plus tardive que dans la référence, *Plus tôt* si elle est plus tôt, sinon *Dans les délais*. *Nouvelle* est une tâche qui ne figure pas dans la référence, *Supprimée* une tâche qui figure dans la référence mais plus dans le planning. Sans référence active, il est écrit *Aucune référence active — enregistrez une référence ou définissez-en une comme active.* Le PDF utilise le papier et l'orientation que vous avez choisis en dernier pour un autre rapport.

## Anticipation

Ce qui est en cours ou commence pendant la période : la liste pour la réunion hebdomadaire. Options sous *Options du rapport*.

**Période de rapport :** — la fenêtre du rapport. Par défaut : *Mois prochain*. Effet : le rapport contient les tâches non terminées qui touchent la période, même si elles couvrent toute la période, ainsi que les tâches en retard d'avant le jour de référence, tant que la fin de la période n'est pas avant le jour de référence.

**Quasi critique ≤ (jo) :** — le seuil de *Quasi critique*. Nombre de 0 à 60. Par défaut : 5. Effet : une tâche dont la marge totale est supérieure à 0 et au plus égale à ce nombre de jours ouvrés est comptée comme quasi critique. À 0, seul ce que l'option de calcul du projet *Marquer quasi critique* marque est compté.

Le bloc *Résumé* compte *Activités*, *En retard*, *En cours*, *Aurait dû démarrer*, *Démarre*, *Critique* et *Quasi critique*. L'état par ligne se rapporte toujours au jour de référence : *En retard* (non terminée, et la fin est avant le jour de référence), *Aurait dû démarrer* (pas démarrée alors que le début était avant le jour de référence), *En cours*, *Démarre* (pas encore démarrée, débute dans la fenêtre). Les colonnes sont *WBS*, *Nom*, *Début*, *Fin*, *Reste (jo)*, *Avanc*, *MT (jo)* (TF), *Critique*, *Ressources* et *État*.

## Critique et quasi critique

Les tâches qui déterminent la fin du projet, et celles qui s'en approchent. Option sous *Options du rapport*.

**Quasi critique ≤ (jo) :** — Par défaut : 5. Nombre de 0 à 60. Effet et sens comme dans la section Anticipation. Le sous-titre indique le seuil choisi.

Le rapport contient les tâches non terminées qui sont critiques (selon le solveur et la définition de critique du projet) ou quasi critiques, triées par chemin de marge, puis par marge totale, puis par début. Le bloc *Résumé* compte *Critique*, *Quasi critique*, *Chaînes critiques* et *Tâches feuilles*. Les colonnes sont *WBS*, *Nom*, *Début*, *Fin*, *Reste (jo)*, *MT (jo)* (TF), *ML (jo)* (FF), *Chemin* et *État*. La colonne *Chemin* montre le chemin de marge si l'option de calcul *Plusieurs chemins de marge* est activée, sinon un tiret.

## Rapport d'avancement

Où en est le projet à la date d’état. Options sous *Options du rapport*.

**Période de rapport :** — Par défaut : *Mois dernier*. Effet : *Terminé pendant la période écoulée* compte dans la période. *Démarre pendant la prochaine période* regarde vers l'avant à partir de la date d’état, jusqu'à *Anticipation jusqu'au* ; avec *Mois dernier*, aussi loin en avant que la période regarde en arrière.

**Quasi critique ≤ (jo) :** — Par défaut : 5. Comme pour l'anticipation.

Le bloc *Résumé* montre *Date d’état*, *Période*, *Anticipation jusqu'au*, *Fin de la référence*, *Fin prévue*, *Δ fin (jo)*, *Prévu* (avec *(référence)* ou *(planning actuel)*), *Réel*, et les compteurs *Terminé*, *En cours*, *Non démarrée*, *En retard* et *Critique*. Le prévu et le réel sont pondérés par la durée des tâches. Le prévu se mesure par rapport à la référence s'il existe une référence active, sinon par rapport au planning actuel. Les sections sont *Terminé pendant la période écoulée*, *En cours*, *Démarre pendant la prochaine période*, *En retard* et *Activités critiques ouvertes* ; une tâche peut figurer dans plus d'une section. Chaque section a les mêmes colonnes : *WBS*, *Nom*, *Fin de la référence*, *Fin prévue*, *Avanc*, *Reste (jo)*, *MT (jo)* (TF), *Critique* et *État*. L'état de chaque ligne est *Terminé*, *En cours*, *Non démarrée*, *Aurait dû démarrer* ou *Aurait dû se terminer*.

## Santé du planning

Une vérification du planning lui-même, à la recherche d'erreurs et de valeurs inhabituelles, avec l'évaluation DCMA en 14 points en haut. Options sous *Options du rapport*.

**Marge élevée > (jo) :** — Nombre de 1 à 365. Par défaut : 44. Effet : une tâche non terminée avec plus de marge totale que cette valeur relève de *Marge élevée*.

**Longue durée > (jo) :** — Nombre de 1 à 365. Par défaut : 44. Effet : une tâche non terminée, qui n'est pas un jalon, dont la durée est plus longue relève de *Longue durée*.

**Décalage > (jo) :** — Nombre de 0 à 365. Par défaut : 10. Effet : une relation avec plus de décalage relève de *Décalage long*. Un décalage négatif (avance) est toujours signalé.

**Quasi critique ≤ (jo) :** — Nombre de 0 à 60. Par défaut : 5. Effet : détermine le contrôle *Quasi critique*.

La section *Évaluation DCMA en 14 points* vient en premier. Elle suit les quatorze contrôles de la US Defense Contract Management Agency, avec les formules et les seuils de leur *EVMS Program Analysis Pamphlet* (DCMA-EA PAM 200.1, octobre 2012). Pour chaque point, vous voyez *Nombre*, *Sur* (le total sur lequel on a compté), *Valeur*, *Seuil*, *Résultat* et *Détail*. Le résultat est *Conforme*, *Signalé* ou *s.o* ; pour s.o, la raison se trouve dans le détail. Un signalement n'est pas un échec : le pamphlet y voit une raison d'aller plus loin. Les seuils sous *Options du rapport* ne s'appliquent pas à cette section ; elle utilise toujours les seuils du pamphlet.

Il compte les tâches feuilles non terminées, sans jalons ni hamacs, et les relations vers de telles tâches. La note au-dessus du rapport donne les deux nombres. Les quatorze points :

- *Logique* : tâches sans prédécesseur ni successeur. Seuil : au plus 5%.
- *Avances* : relations avec un décalage négatif. Seuil : aucun.
- *Décalages* : relations avec un décalage positif, même court. Seuil : au plus 5%.
- *Types de relation* : la part des relations FS. Seuil : au moins 90%.
- *Contraintes strictes* : tâches avec une contrainte obligatoire (MSO, MFO, SNLT ou FNLT). Seuil : au plus 5%.
- *Marge élevée* : tâches avec plus de 44 jours ouvrés de marge totale. Seuil : au plus 5%. Nécessite un calcul.
- *Marge négative* : tâches avec une marge totale inférieure à 0. Seuil : aucun. Nécessite un calcul.
- *Durée élevée* : tâches plus longues que 44 jours ouvrés. Compte la durée de référence si la tâche figure dans la référence active, sinon la durée actuelle. Seuil : au plus 5%.
- *Dates invalides* : un début réel ou une fin réelle après la date d'état, ou un début prévu ou une fin prévue avant la date d'état. Seuil : aucun. Nécessite une date d'état.
- *Ressources* : tâches sans ressource. Seuil : aucun. Seulement si le projet utilise des ressources ; sinon *s.o*.
- *Tâches manquées* : parmi les tâches que la référence prévoit terminées au plus tard à la date d'état, la part qui finit plus tard ou dont la fin prévue est plus tardive. Seuil : au plus 5%. Nécessite une date d'état et une référence active.
- *Test du chemin critique* : l'application allonge une tâche critique de 100 jours ouvrés et lance un recalcul, sur une copie, sans modifier le projet. Le test réussit si la dernière tâche du projet ne finit alors pas avant cette tâche. Il teste la tâche critique non terminée dont le début au plus tôt est le plus ancien ; le détail indique la tâche et le nombre de jours ouvrés dont la fin a été repoussée. Dans la vue *Dates telles qu'enregistrées*, ce test est *s.o* (*non calculé*) : le test lance un calcul, et le rapport affiche alors les dates du fichier source. Appuyez sur Calculer (F5) et le test s'exécute de nouveau.
- *CPLI* : (longueur du chemin critique + marge) / longueur du chemin critique. La longueur compte les jours ouvrés depuis la date d'état jusqu'à la fin de la dernière tâche ; la marge est la différence avec la fin de référence de cette tâche, ou la marge calculée si la tâche ne figure pas dans la référence. Seuil : au moins 0,95. Nécessite une date d'état.
- *BEI* : le nombre de tâches terminées à la date d'état, divisé par le nombre que la référence prévoit terminées à cette date, plus les tâches sans référence. Seuil : au moins 0,95. Nécessite une date d'état et une référence active.

Deux points diffèrent du pamphlet, parce que l'application n'a pas ce concept : *Durée élevée* compte chaque tâche non terminée, alors que le pamphlet la limite à la période de planification détaillée (planification glissante, rolling wave), et *Ressources* ne regarde que les ressources affectées, pas les coûts. Le pamphlet ne donne pas de chiffre pour le test du chemin critique ; les 100 jours ouvrés sont le choix de l'application.

Les contrôles sont dans cet ordre, avec leur gravité. Erreur : *Marge négative*, *Échéance manquée*, *Contrainte violée* et *Avancement incohérent* (début réel ou fin réelle après la date d'état, début prévu ou fin prévue avant la date d'état, 100% sans fin réelle, fin réelle mais pas 100%, avancement sans début réel). Avertissement : *Sans prédécesseur (début ouvert)* et *Sans successeur (fin ouverte)* (pas les jalons), *Longue durée*, *Avance (décalage négatif)*, *Contrainte stricte* (une contrainte obligatoire, MSO, MFO, SNLT ou FNLT), *Avancement hors séquence* et *Tâche manquée (par rapport à la référence)*. Info : *Quasi critique*, *Marge élevée*, *Décalage long*, *Relation autre que FS* et *Sans ressource* (seulement si le projet utilise des ressources). Le rapport ne regarde que les tâches feuilles qui ne sont pas des hamacs. Le bloc *Résumé* compte les *Signalements DCMA*, *Erreurs*, *Avertissements*, *Informations*, *Tâches feuilles* et *Relations* ; sous la section DCMA se trouvent une section *Vue d'ensemble* (par contrôle, la gravité et le nombre) et une section *Constats* (chaque tâche ou relation). Sans calcul, les contrôles qui demandent la marge sont absents.

## Charge des ressources

Par ressource, par semaine ou par mois, ce qui est requis face à ce qui est disponible. Options sous *Options du rapport*.

**Période de rapport :** — Par défaut : *Tout le projet*. Effet : chaque semaine ou mois qui touche la période est compté en entier. Ainsi, une ligne affiche le même nombre que l'histogramme.

**Regroupement :** — Choisissez entre *Par semaine* et *Par mois*. Par défaut : *Par semaine*. Effet : une ligne par semaine civile (colonne *Semaine du*, avec le lundi) ou par mois civil (colonne *Mois*).

**Seulement les périodes surchargées** — Par défaut : désactivé. Effet : activé n'affiche que les semaines ou les mois avec au moins un jour surchargé.

Les colonnes sont *Ressource*, *Type*, *Semaine du* ou *Mois*, *Requis*, *Disponible*, *Écart* (disponible moins requis ; négatif signifie un manque), *Pic/jour* et *Surchargé*. *Requis* est la somme des unités-jours. Seules les semaines ou mois avec une demande y figurent. Le bloc *Résumé* compte les *Ressources*, les *Semaines* ou *Mois*, les *Semaines surchargées* ou *Mois surchargés* et les *Ressources surchargées*.

## Affectations des ressources

Par ressource, les tâches auxquelles elle est rattachée : que fait cette équipe ou cette grue ? Options sous *Options du rapport*.

**Période de rapport :** — Par défaut : *Tout le projet*. Effet : avec une période, seules les affectations de tâches qui touchent la période sont incluses, plus le travail en retard d'avant le jour de référence. *Tout le projet* ne filtre pas par date.

**Inclure les tâches terminées** — Par défaut : désactivé. Effet : activé inclut aussi les affectations des tâches terminées.

Les lignes sont classées par ressource, et au sein d'une ressource par début. Le bloc *Résumé* compte les *Ressources*, les *Affectations* et les *Tâches sans ressource*. Les colonnes sont *Ressource*, *Type*, *WBS*, *Nom*, *Début*, *Fin*, *Reste (jo)*, *Unités/jour*, *Av*, *Critique* et *État*. *Ressource* et *Type* n'apparaissent que sur la première ligne d'une ressource. L'état de chaque ligne est le même que dans le rapport d'avancement : *Terminé*, *En cours*, *Non démarrée*, *Aurait dû démarrer* ou *Aurait dû se terminer*.

## Résumé WBS

Le planning regroupé par élément WBS : la vue de synthèse pour la direction. Options sous *Options du rapport*.

**Niveau :** — jusqu'à quel niveau la WBS est affichée. Choisissez entre *WBS complet* et les niveaux 1 à 8. Par défaut : niveau 2. Effet : le sous-titre indique *Jusqu'au niveau 2*.

**Afficher les tâches** — Par défaut : désactivé. Effet : activé affiche aussi les tâches feuilles elles-mêmes sous chaque élément.

Les colonnes incluent *WBS*, *Nom*, *Début*, *Fin*, *Début de référence*, *Fin de référence*, *Durée (jo)*, *Av*, *Δ fin (jo)*, *MT min*, *Act* (nombre de tâches), *Crit*, *En cours* et *Terminé*. Le début et la fin d'une tâche récapitulative viennent du dernier calcul. L'avancement est pondéré par la durée des tâches feuilles. *MT min* (TF) et les comptages concernent les tâches feuilles ci-dessous. Le bloc *Résumé* compte les *Éléments WBS* et les *Activités*.

## Période de rapport

Quatre rapports de tableau et le diagramme des ressources travaillent avec une *Période de rapport* : *Prévision (look-ahead)*, *Rapport d'avancement*, *Charge des ressources*, *Affectations des ressources* et *Diagramme des ressources*. Chaque rapport garde sa propre période. Sous la liste déroulante se trouvent *Du* et *Au*, avec les dates que produit le choix.

**Jour de référence.** Une période avec *Suivant* ou *Précédent* se compte à partir de la date d'état du projet, ou d'aujourd'hui s'il n'y a pas de date d'état. Les rapports de tableau affichent alors *Aucune date d'état définie — le rapport utilise aujourd'hui (…).* Si vous déplacez la date d'état, la fenêtre se déplace avec elle. Les deux jours sont compris.

**Semaine prochaine, 2 prochaines semaines, 4 prochaines semaines, 6 prochaines semaines, 8 prochaines semaines, 12 prochaines semaines** — à partir du jour de référence, de 7 jours par semaine. Avec une date d'état le jeudi 20 mai, *Semaine prochaine* va du 20 au 26 mai et *4 prochaines semaines* du 20 mai au 16 juin.

**Semaine dernière, 2 dernières semaines, 4 dernières semaines, 6 dernières semaines, 8 dernières semaines, 12 dernières semaines** — les mêmes six, mais comptées en arrière : de 7 jours par semaine, jusqu'au jour de référence inclus. *2 dernières semaines* va du 7 au 20 mai, avec le 20 mai comme jour de référence.

**Mois prochain, Mois dernier** — un mois civil en avant ou en arrière, jusqu'à un jour avant la même date dans l'autre mois. *Mois prochain* va jusqu'au 19 juin, à partir du 20 mai ; *Mois dernier* va du 21 avril au 20 mai.

**Tout le projet** — du premier début à la dernière fin du planning.

**Personnalisée** — votre propre période. Effet : *Du* et *Au* deviennent deux champs de date. Ils commencent avec les dates du choix que vous veniez de faire. La date de fin ne peut pas être antérieure à la date de début (*La date de fin est antérieure à la date de début.*) et les deux champs doivent être remplis (*Renseignez les deux dates.*). Si la saisie n'est pas correcte, le rapport reste sur la dernière période valide.

## Voir aussi

- [Créer et imprimer un rapport](docs://howto-rapport-maken-en-afdrukken) : tout le parcours, du type de rapport au PDF.
- [Choisir la période de rapport](docs://howto-rapportageperiode-kiezen) : étapes et exemples.
- [Chemin critique et marge](docs://uitleg-kritiek-pad) : ce que signifient critique et quasi critique.
- [Avancement, date d'état et référence](docs://uitleg-voortgang) : la date d'état et la référence avec lesquelles les rapports travaillent.
- [Résoudre la surallocation](docs://howto-overbezetting-oplossen) : que faire avec les semaines surchargées du rapport Charge des ressources.
- [Formats d'import et d'export](docs://ref-import-exportformaten) : le PDF à côté des autres formats.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc) : deux références avec avancement et une date d'état, pour regarder le rapport de variance.
