# Créer et imprimer un rapport

Objectif : choisir un rapport de votre planning, le vérifier dans l'aperçu et l'enregistrer en PDF, pour que vous puissiez le distribuer ou l'imprimer vous-même.

## Quand en avez-vous besoin

Le vendredi, c'est la réunion de chantier. Le client veut le planning sur papier, le conducteur de travaux veut savoir ce qui commence dans les semaines à venir, et le chef de chantier veut une feuille avec uniquement ses propres tâches. Vous créez des synthèses de ce type dans l'onglet *Rapport*. L'application les calcule à partir de votre planning et les affiche d'abord en aperçu. Ensuite, vous les exportez en PDF.

L'application n'envoie pas elle-même un rapport à une imprimante. Le résultat final est toujours un PDF. Vous l'imprimez avec votre lecteur PDF, ou vous l'envoyez par e-mail.

## Étapes

### 1. Ouvrir l'onglet Rapport

Choisissez *Rapport* dans le ruban, ou appuyez sur Ctrl+P. Ctrl+P vous amène à cet onglet. Si vous saisissez du texte dans un champ, si une boîte de dialogue est ouverte ou si le mode présentation est activé, Ctrl+P ne fonctionne pas. Dans le navigateur, la boîte de dialogue d'impression du navigateur s'ouvre alors, et elle imprime l'écran, pas le rapport.

À gauche se trouve le panneau *Rapport*, avec la liste *Type de rapport*, un résumé et les paramètres. À droite se trouve l'aperçu.

### 2. Choisir le type de rapport

La liste *Type de rapport* contient onze rapports. Choisissez celui qui correspond à votre question.

- *Diagramme de Gantt* : le planning sous forme de diagramme à barres, pour le planning standard à distribuer.
- *Diagramme des ressources* : les mêmes barres, mais avec une bande par ressource. Pour « que fait l'équipe X ? », si vous le souhaitez avec une feuille par équipe.
- *Aperçu des jalons* : tous les jalons, avec leur date et leur statut.
- *Variance* : le planning actuel à côté de la référence active. Pour « de combien avons-nous pris du retard ? ».
- *Prévision (look-ahead)* : ce qui est en cours ou commence dans la période à venir. La liste pour la réunion hebdomadaire.
- *Critique & quasi critique* : les tâches sans marge, ou avec presque aucune marge.
- *Rapport d'avancement* : où en est le projet à la date d'état, le jour où vous mesurez l'avancement.
- *Santé du planning* : une vérification du planning lui-même, pour détecter les erreurs et les valeurs inhabituelles.
- *Charge des ressources* : par ressource et par semaine ou par mois, ce qui est demandé par rapport à ce qui est disponible.
- *Affectations des ressources* : par ressource, les tâches auxquelles elle est affectée.
- *Synthèse WBS* : le planning regroupé par niveau WBS, pour la direction.

### 3. Vérifier que le planning est à jour

L'application ne calcule pas d'elle-même. Si vous avez modifié des tâches, des relations ou des calendriers depuis le dernier calcul, appuyez sur **Calculer** (F5). Les rapports en tableau vous avertissent eux-mêmes, en haut du rapport : *Le planning a changé depuis le dernier calcul — appuyez sur Calculer (F5) pour des valeurs à jour*. Ou, si le planning n'a encore jamais été calculé : *Pas encore calculé — appuyez sur Calculer (F5) pour les dates et les marges*.

Le ruban de l'onglet Rapport n'a pas de bouton Calculer, mais F5 fonctionne très bien ici. *Exporter en PDF* calcule aussi d'abord de lui-même si le planning n'est plus à jour, de sorte que le PDF n'est jamais en retard sur votre planning.

### 4. Adapter le rapport

Sous *Paramètres* se trouvent les choix pour le diagramme de Gantt et le diagramme des ressources. Prévision (look-ahead), Critique & quasi critique, Rapport d'avancement, Santé du planning, Charge des ressources, Affectations des ressources et Synthèse WBS ont seulement *Papier* et *Orientation*, ainsi qu'un bloc *Options du rapport* avec les choix de ce rapport. L'aperçu des jalons et la Variance n'ont pas de choix propres. Pour la période d'un rapport, voir [Choisir la période de rapport](docs://howto-rapportageperiode-kiezen).

- *Papier* et *Orientation* déterminent la feuille. Par défaut, il s'agit de A3 paysage, ce qui convient à un planning de chantier, mais toutes les imprimantes n'impriment pas le A3. Si vous avez une imprimante A4, choisissez A4 dès maintenant : l'application met alors les pages en forme pour A4, et vous n'avez pas à les réduire plus tard.
- Avec le diagramme des ressources, la case *Chaque ressource sur une nouvelle page* donne une feuille par équipe.
- *Taille de police* (de 90 % à 125 %) rend le texte et le tableau plus grands ou plus petits. Une police plus grande laisse moins de place pour la chronologie.
- *Suivre la vue (filtre, groupe, tri)* n'apparaît que pour le diagramme de Gantt. Par défaut, toute l'arborescence des tâches est imprimée. Avec cette case, le rapport dessine exactement les lignes que vous voyez à l'écran, y compris les phases repliées, par exemple seulement les tâches critiques d'une disposition. Comment créer une telle vue est expliqué dans [Créer et utiliser une disposition](docs://howto-layouts-gebruiken).
- *Afficher la superposition de référence* affiche la référence active à côté des barres actuelles. Avec *Ligne d’état*, vous choisissez une *Ligne de date d’état* ou une *Ligne d’avancement*.
- *Ajustement automatique au papier* est activé par défaut : la chronologie est alors mise à l'échelle sur la largeur de la page, et le nombre de pages dépend de la hauteur. Si vous le désactivez, le rapport utilise un zoom fixe et se répartit aussi sur la largeur, ce qui produit vite beaucoup de pages. Avec *Chronologie sur*, vous répartissez la chronologie sur 2 à 8 pages de large avec l'ajustement automatique, pour un long planning que vous voulez imprimer à une taille lisible.

### 5. Contrôler l'aperçu

Pour le diagramme de Gantt et le diagramme des ressources, vous voyez la feuille avec l'en-tête de page, le tableau, la chronologie et la légende. Faites défiler pour regarder les pages. *Qualité de l’aperçu* règle seulement la netteté de l'aperçu à l'écran ; le PDF ne change pas avec ce réglage. Si, sous les pages, il est écrit *… et 1 page de plus — exportez pour le document complet* (avec davantage de pages : *… et 2 pages de plus — exportez pour le document complet*), l'aperçu n'a pas encore généré toutes les pages. Le PDF contient toutes les pages.

Les autres rapports s'affichent à l'écran sous forme de tableau. Ce que vous voyez se retrouve dans le PDF.

### 6. Exporter en PDF

En bas du panneau de gauche, cliquez sur **Exporter en PDF**. Le nom de fichier proposé est le nom du projet, suivi du type de rapport ; pour le diagramme de Gantt, par exemple *Extension house-planning.pdf*.

- Dans l'application de bureau, ainsi que dans un navigateur qui dispose d'une boîte de dialogue d'enregistrement de fichiers, vous choisissez où le PDF est enregistré. Si vous fermez cette boîte de dialogue sans enregistrer, rien ne se passe.
- Dans un navigateur sans cette boîte de dialogue, le navigateur place le PDF dans votre dossier de téléchargements.

### 7. Imprimer le PDF

Ouvrez le PDF dans votre lecteur PDF et imprimez-le depuis celui-ci. Si vous imprimez un PDF A3 sur une imprimante A4, la boîte de dialogue d'impression doit réduire les pages. Définissez donc d'abord le format du papier à l'étape 4.

## Pièges et ce que fait l'application

**Le bouton Imprimer et Ctrl+P n'impriment pas.** Le bouton *Imprimer* du groupe *Rapport* se trouve sur l'onglet Rapport lui-même et ne fait rien de plus. Ctrl+P vous amène à cet onglet. L'application n'a pas de commande d'impression séparée : pour obtenir du papier, il faut passer par le PDF. Si Ctrl+P ne fonctionne pas (voir l'étape 1), la boîte de dialogue d'impression du navigateur s'ouvre, et elle imprime l'écran, pas le rapport.

**Entreprise : ce que vous écrivez par-dessus n'est pas conservé.** Le champ *Entreprise* du diagramme de Gantt commence avec l'entreprise des paramètres du projet. Ce que vous saisissez par-dessus n'est pas conservé. Vous ne pouvez pas saisir *Auteur* ici. Vous modifiez les deux dans *Paramètres › Projet › Paramètres du projet*, dans les champs *Client/organisation* et *Auteur*, puis validez avec *Appliquer*.

**Couleurs des barres : s'applique aussi à votre écran.** Le choix *Couleurs des barres* dans le rapport est le même que *Couleurs des barres* sous l'onglet Affichage. Si vous le modifiez dans le rapport, votre diagramme de Gantt à l'écran change aussi.

**La Variance sans référence.** Une référence est une copie enregistrée de votre planning, à laquelle vous comparez plus tard. Comment l'enregistrer est expliqué dans [Enregistrer et gérer une référence](docs://howto-baseline-opslaan-en-beheren). Si vous n'avez pas de référence active, la Variance n'affiche pas de comparaison, mais : *Aucune référence active — enregistrez une référence ou définissez-en une comme active.*

**Ligne d’état sans date d’état.** Si vous choisissez une *Ligne d’état* alors que le projet n'a pas de date d'état, le rapport affiche *Définissez d’abord une date d’état* et ne dessine rien. Vous définissez la date d'état dans *Planification › Références et avancement › Date d’état*.

**Le planning contient une boucle.** Si le planning contient une boucle, *Exporter en PDF* ne crée pas de fichier et affiche l'erreur.

**Le papier s'applique actuellement à tous les rapports.** Il n'existe qu'un seul choix pour *Papier* et *Orientation*, partagé par tous les rapports. L'aperçu des jalons et la Variance n'ont pas de choix de papier propre : ils utilisent ce que vous avez défini dans un autre rapport, par défaut A3 paysage. Choisissez donc d'abord le papier dans un rapport qui le propose, par exemple le diagramme de Gantt, puis revenez.

**Les paramètres s'appliquent à tous les projets.** Le papier, la taille de police, la période et les autres choix sont mémorisés par l'application sur cet appareil, pour tous vos projets. Ils ne font pas partie du fichier de projet.

## Voir aussi

- [Choisir la période de rapport](docs://howto-rapportageperiode-kiezen) : une prévision ou un rapport d'avancement sur une durée donnée.
- [Créer et utiliser une disposition](docs://howto-layouts-gebruiken) : filtrez ou groupez d'abord, puis imprimez avec *Suivre la vue*.
- [Enregistrer et gérer une référence](docs://howto-baseline-opslaan-en-beheren) : la copie à laquelle la Variance compare le planning.
- [Résoudre la surallocation](docs://howto-overbezetting-oplossen) : que faire quand la Charge des ressources affiche des semaines en surallocation.
- [Chemin critique et marge](docs://uitleg-kritiek-pad) : pourquoi une tâche est critique ou quasi critique.
- [Types de rapport](docs://ref-rapporttypes) : tous les types de rapport et leurs options.
