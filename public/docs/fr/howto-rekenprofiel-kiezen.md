# Choisir ou créer un profil de calcul

Objectif : décider quelles règles de calcul un projet utilise. Vous choisissez un profil intégré, ou vous créez un profil personnalisé avec vos propres conventions.

## Quand vous en avez besoin

Vous ouvrez un projet qui doit calculer comme Primavera P6 ou Microsoft Project, ou vous voulez régler une convention autrement que le profil ne le fait. Ce qu'est un profil et pourquoi les dates peuvent se décaler est expliqué dans [Profils de calcul et conventions](docs://uitleg-rekenprofielen).

## Étapes

### Choisir un profil pour un nouveau projet

1. Choisissez *Accueil › Fichier › Nouveau*. La fenêtre *Nouveau projet* s'ouvre.
2. Dans la liste déroulante *Profil de calcul*, choisissez le profil : *Open Planner Studio*, *Primavera P6* ou *Microsoft Project*.
3. Créez le projet. L'application remplace les options de calcul que vous aviez déjà remplies par les valeurs par défaut du profil.

### Changer le profil d'un projet existant

1. Choisissez *Paramètres › Projet › Paramètres du projet*. Vous pouvez aussi choisir *Fichier › Paramètres du projet*.
2. Dans le bloc *Profil de calcul et options*, ouvrez la liste déroulante *Profil de calcul* et choisissez un autre profil.
3. Cliquez sur **Appliquer**. L'application recalcule le planning tout de suite, même si *Calculer automatiquement* est désactivé. Si des tâches ont bougé, l'application indique combien.

Tant que vous ne cliquez pas sur *Appliquer*, le changement n'existe que dans le formulaire. Tout le changement forme une seule étape pour *Annuler*. Changer de profil ne modifie que les conventions ; vos options de calcul restent telles quelles.

### Créer un profil personnalisé

1. Dans le bloc *Profil de calcul et options*, cliquez sur *Nouveau profil*, à côté de la liste déroulante.
2. Saisissez un nom. L'application propose le nom *Copie de* suivi du nom du profil choisi, par exemple *Copie de Open Planner Studio*.
3. Cliquez sur *Créer*. La partie *Conventions de ce profil* se déploie.
4. Activez ou désactivez les conventions avec les cases à cocher. L'icône i après une ligne affiche l'explication de cette convention. Une convention qui diffère de la base reçoit l'étiquette *revenir à la base*.
5. Cliquez sur **Appliquer**. Ce n'est qu'alors que le projet calcule avec le nouveau profil.

Les trois profils intégrés ne peuvent pas être modifiés. Leurs conventions sont affichées uniquement à titre d'information.

### Garder un profil personnalisé comme modèle

1. Si nécessaire, donnez au profil personnalisé un autre nom dans le champ *Nom de ce profil personnalisé*.
2. Cliquez sur *Enregistrer comme modèle*. L'application indique que le modèle a été enregistré, ou pourquoi cela a échoué.
3. Dans un autre projet de la même application, le modèle figure dans la liste déroulante *Profil de calcul*.

Si le profil diffère plus tard du modèle, un bloc jaune l'indique. Choisissez alors *Mettre à jour le modèle depuis ce projet* ou *Mettre à jour depuis le modèle*.

Vous supprimez un modèle avec *Supprimer le modèle*. L'application demande d'abord une confirmation.

## Vérifier le résultat

- Le bloc *Profil de calcul et options* affiche le profil choisi.
- Après *Appliquer*, l'application indique les tâches déplacées, par exemple *Après application, 4 tâches ont été déplacées.*
- Un bloc orange au-dessus des options de calcul indique que vos options de calcul diffèrent des valeurs par défaut du profil. C'est souvent voulu. Si vous voulez quand même les valeurs par défaut, cliquez sur *Utiliser les paramètres par défaut de …*.

## Pièges et ce que fait l'application

**Les dates se décalent.** Un autre profil peut modifier réellement les dates. Vérifiez le résultat. Si le résultat ne vous convient pas, choisissez *Annuler* : le profil et les dates reviennent ensemble.

**Un bloc jaune après Annuler.** Si vous appuyez sur *Annuler* ou *Rétablir* pendant que *Paramètres du projet* est ouvert, le bloc suit l'état du projet. Si vous aviez déjà modifié quelque chose dans le bloc vous-même, votre choix reste. Un bloc jaune indique alors qu'*Appliquer* remet ce choix en place.

**Il peut y avoir au maximum 100 modèles.** S'il y en a déjà 100, l'application n'enregistre pas le modèle et l'indique. Supprimez d'abord un modèle. Un stockage plein ou absent de l'application affiche aussi un message.

**Les modèles appartiennent à l'application, le profil au projet.** Le projet garde toujours sa propre copie du profil. Si vous modifiez le modèle plus tard, le projet ne change pas avec lui.

**Paramètres venant d'un fichier source.** Si vous choisissez *Primavera P6* ou *Microsoft Project* pour un projet qui vient d'un autre fichier, les paramètres du fichier source restent. Vous ne pouvez pas les modifier ici.

## Voir aussi

- [Profils de calcul et conventions](docs://uitleg-rekenprofielen) : ce qu'est un profil et ce qu'il fait aux dates.
- [Options de calcul et conventions](docs://ref-rekenopties-en-conventies) : toutes les conventions et options de calcul en un coup d'œil.
- [Choisir le mode d'avancement](docs://howto-voortgangsmodus-kiezen) : Retained Logic ou Progress Override, séparé du profil.
