# Travailler sur plusieurs projets à la fois

Objectif : avoir plus d'un planning ouvert, passer de l'un à l'autre et les fermer séparément.

## Quand vous en avez besoin

Vous travaillez sur le projet de logements du quartier, mais la réunion de chantier porte aussi sur la rénovation du club-house. Ou vous voulez garder une variante à côté de l'original. Chaque projet est dans son propre onglet, avec ses propres tâches, son propre calcul et sa propre fenêtre temporelle. Passer de l'un à l'autre prend un clic, et vous ne perdez rien.

## Étapes

### Ouvrir un deuxième projet

1. Cliquez sur le bouton plus à droite des onglets (*Démarrer un projet*). La fenêtre *Démarrer un projet* s'ouvre.
2. Choisissez *Nouveau projet* pour un planning vide, ou *Ouvrir un projet existant* pour choisir un fichier. *Annuler* ferme la fenêtre.
3. Avec *Nouveau projet*, remplissez la fenêtre *Nouveau projet* et cliquez sur *Créer*.

Le projet apparaît dans son propre onglet et il est actif tout de suite. *Nouveau* et *Ouvrir* dans le ruban, Ctrl+O et les exemples dans *Fichier › Exemples* ouvrent aussi un projet dans un nouvel onglet. Seul un planning neuf et vide, que vous n'avez pas encore modifié, est réutilisé au lieu d'ajouter un onglet.

### Passer d'un projet à l'autre

- Cliquez sur l'onglet du projet.
- Appuyez sur Ctrl+1 à Ctrl+9 (⌘ au lieu de Ctrl sous macOS) pour le projet à cette place dans la rangée, en comptant de gauche à droite.
- Cliquez sur l'icône de menu à gauche des onglets (*Tous les projets*). L'aperçu *Projets ouverts* affiche une carte par projet avec son nom, le nom du fichier (si le projet a un fichier), une miniature du planning, le nombre de tâches, le nombre de tâches critiques et la date de fin. Cliquez sur une carte pour y aller. Échap ferme l'aperçu.

Chaque onglet a un point coloré qui appartient au projet. Un onglet avec un petit point à côté de son nom a des modifications non enregistrées.

Si les onglets ne tiennent pas tous en largeur, deux flèches apparaissent entre les onglets et le bouton plus (*Faire défiler les onglets vers le début* et *Faire défiler les onglets vers la fin*). Chaque clic déplace les onglets de deux. Une flèche est grise quand vous êtes déjà au début ou à la fin. Vous pouvez aussi faire défiler les onglets avec la molette de la souris. L'onglet que vous choisissez se rend toujours visible automatiquement.

### Fermer un projet

Cliquez sur la croix à côté du nom sur l'onglet (*Fermer*), ou sur la croix d'une carte de l'aperçu. Un projet sans modifications se ferme tout de suite. S'il a des modifications non enregistrées, l'application demande *Modifications non enregistrées* avec trois choix :

- *Enregistrer* enregistre le projet, puis le ferme.
- *Ne pas enregistrer* ferme le projet et supprime les modifications.
- *Annuler* laisse le projet ouvert.

Si vous annulez l'enregistrement, par exemple en fermant la boîte de dialogue d'enregistrement, le projet reste ouvert.

Si vous fermez le dernier projet, un planning vide appelé *Nouvelle planification* reste.

### Choisir le style de changement de document

Vous pouvez choisir le style des onglets. Ouvrez la fenêtre *Paramètres de l'app* avec le rouage dans la barre de titre, allez à l'onglet *Apparence* et choisissez *Style de changement de document* :

- *Onglets horizontaux* : l'option par défaut. Une rangée d'onglets sous le ruban.
- *Onglets verticaux* : une barre étroite à gauche avec un bouton par projet (les premières lettres du nom) et un bouton plus. Si vous passez la souris sur un bouton, vous voyez le nom, le nom du fichier, le nombre de tâches, le nombre de tâches critiques et la date de fin. Le bouton en haut ouvre l'aperçu.
- *Pastille* : une pastille dans la barre de titre avec le nom du projet actif et un compteur tel que *2 ouverts*. Cliquez dessus pour ouvrir l'aperçu et changer de projet là.

Les trois styles ouvrent le même aperçu, et Ctrl+1 à Ctrl+9 fonctionne dans chaque style.

## Pièges et comportement de l'application

**Ce qui appartient au projet et ce qui est partagé.** Chaque projet a sa propre vue : le zoom et la position, une disposition active avec filtre, regroupement ou tri, la vue partagée, les lignes de relation et les phases réduites. Si vous passez à un autre projet, vous voyez sa propre vue. Sont partagés par tous les projets : l'onglet sélectionné du ruban, la mini-carte, les superpositions (superposition de référence, ligne d'avancement et le reste), votre choix de colonnes, vos dispositions et vos choix de rapport.

**Vous ne pouvez pas changer de projet quand une boîte de dialogue est ouverte.** Tant qu'une boîte de dialogue est ouverte, par exemple la fenêtre *Paramètres de l'app* ou la fenêtre d'une tâche, Ctrl+1 à Ctrl+9 ne font rien dans l'application. Dans le navigateur, elles changent alors d'onglet de navigateur. Fermez d'abord la boîte de dialogue. Une modification non appliquée dans *Paramètres du projet* dans le Backstage bloque aussi le changement de projet.

**Ctrl+1 à Ctrl+9 suivent l'ordre.** Le raccourci va au projet à cette place dans la rangée. Si vous fermez un projet, les autres places remontent d'un rang. Si vous avez plus de neuf projets ouverts, vous atteignez les autres uniquement par les onglets ou l'aperçu.

**Calculer et les rapports concernent le projet actif.** Calculer (F5), *Exporter en PDF* et les rapports concernent le projet qui est actif maintenant.

## Voir aussi

- [Créer et utiliser une disposition](docs://howto-layouts-gebruiken): configurer une vue par projet.
- [Créer et imprimer un rapport](docs://howto-rapport-maken-en-afdrukken): le rapport du projet actif.
