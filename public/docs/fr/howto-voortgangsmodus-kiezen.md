# Choisir le mode d'avancement

Objectif : décider comment l'application planifie le travail restant d'une tâche déjà commencée alors que son prédécesseur est encore en cours : selon la relation (Retained Logic) ou selon ce qui se passe réellement (Progress Override).

## Quand vous en avez besoin

Sur le chantier, les travaux devancent souvent la logique du planning. Le peintre commence déjà dans les pièces qui ont été plâtrées, alors que le plâtrier est encore occupé ailleurs. Dans le planning, cela correspond par exemple à une relation fin-début dont le successeur commence avant la fin de son prédécesseur. L'application appelle cela **hors séquence**. Si la barre d'état affiche *N relation(s) hors séquence*, vous êtes dans ce cas. Le mode d'avancement décide alors comment l'application planifie le travail restant du successeur. Ce que font les deux modes, avec un exemple détaillé, est décrit dans [Avancement, date d'état et référence](docs://uitleg-voortgang).

## Étapes

1. Mettez à jour l'avancement et définissez la date d'état, comme décrit dans [Mise à jour de l'avancement](docs://howto-voortgang-bijwerken).
2. Allez dans *Planification › Références et avancement › Mode d'avancement* et ouvrez la liste.
3. Choisissez *Retained Logic* ou *Progress Override*.
4. Appuyez sur **Calculer** (F5), par exemple via *Planification › Planification › Calculer*. Ce choix rend le planning obsolète : la barre d'état affiche *Obsolète — recalculer (F5)*. Si *Calculer automatiquement* est activé, l'application le fait elle-même.

Comment choisir ?

- **Retained Logic** est le mode par défaut. La relation reste en vigueur : le travail restant du successeur ne commence qu'une fois le prédécesseur terminé. Choisissez ce mode si l'ordre est vraiment fixe, ou si vous voulez planifier avec prudence.
- **Progress Override** laisse la réalité l'emporter. Le travail restant du successeur commence à la date d'état, sans attendre le prédécesseur. Choisissez ce mode si le successeur continue réellement de travailler et si la date de fin ne doit pas dépendre d'un prédécesseur encore en cours.

## Vérifier le résultat

- Cliquez sur le message *N relation(s) hors séquence* dans la barre d'état. Le panneau *Avertissements* s'ouvre, accessible aussi via *Planification › Planification › Avertissements*. Chaque relation y apparaît avec le texte *Hors séquence : l'avancement du successeur contredit la relation*, par exemple *4.2 Plastering → 4.5 Painting (FS)*.
- Regardez la barre du successeur. Avec Retained Logic, elle dure jusqu'après la fin de son prédécesseur. Avec Progress Override, elle se termine plus tôt. Dans l'exemple de l'explication, c'est mardi 27 juillet contre jeudi 22 juillet.

## Pièges et comportement de l'application

**Aucune différence.** Le mode n'a d'effet que sur les tâches déjà commencées alors que leur prédécesseur n'est pas encore terminé. Sans une telle tâche, rien ne change.

**Le message reste.** Progress Override ne résout pas le message hors séquence. Le mode décide comment l'application calcule ; la contradiction entre la relation et l'avancement reste. Si la relation n'est plus juste, modifiez-la ([Ajouter des relations](docs://howto-relaties-leggen)).

**Il appartient au projet.** Le choix est enregistré avec le fichier du projet, s'applique à tout le projet et peut être annulé avec Ctrl+Z. Un nouveau projet est réglé sur Retained Logic.

**Un fichier P6.** Si vous ouvrez un fichier Primavera P6 (.xer), l'application prend le mode du fichier. À côté de Retained Logic et Progress Override, P6 propose aussi le mode Actual Dates. L'application ne connaît pas ce troisième mode ; un tel fichier se calcule avec Retained Logic. Le message d'importation le compte comme *1 paramètre de planification P6 a utilisé un repli sûr.*

**Le profil de calcul.** Dans le profil Primavera P6, Progress Override agit aussi en arrière, sur les dates au plus tard et la marge libre du prédécesseur (convention *Progress Override ignore aussi en arrière un successeur commencé*). Dans les profils Open Planner Studio et Microsoft Project, ce n'est pas le cas. Vous trouvez les conventions sous *Paramètres › Projet › Paramètres du projet*, dans le bloc *Profil de calcul et options*. Dans l'exemple de l'explication, cet effet en arrière ne se voit pas.

## Voir aussi

- [Avancement, date d'état et référence](docs://uitleg-voortgang) : la différence entre les deux modes, avec des chiffres.
- [Mise à jour de l'avancement](docs://howto-voortgang-bijwerken) : la saisie de l'avancement sur lequel agit le mode.
- [Ajouter des relations](docs://howto-relaties-leggen) : modifier une relation qui n'est plus juste.
