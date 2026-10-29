# Chemin critique et marge

Pourquoi la date de fin de votre projet est-elle celle qu'elle est ? Et quelle tâche peut prendre un jour de retard sans décaler la remise ? Ce sont les questions auxquelles répond le chemin critique. Cet article explique précisément ce que l'application calcule, à l'aide d'un exemple détaillé.

## Le concept

Un planning est un réseau de tâches reliées par des **relations** : des accords, comme « les châssis de fenêtre ne se posent qu'une fois la toiture fermée ». Ces relations lient les tâches entre elles. Certaines chaînes de tâches sont plus longues que d'autres. La chaîne la plus longue détermine la durée totale du projet.

Cette chaîne la plus longue est le **chemin critique**. Si une tâche de ce chemin prend un jour de retard, la remise se décale d'un jour. Il n'y a aucune marge sur ce chemin.

Les tâches hors du chemin critique disposent de temps disponible. Ce temps s'appelle la **marge**. Le maçon qui monte la paroi extérieure du mur à double paroi peut commencer deux jours plus tard sans que personne ne le remarque. Ces deux jours sont la marge de cette tâche.

Donc critique ne dit rien de l'importance d'une tâche. Cela indique seulement qu'il n'y a pas de temps de réserve.

La méthode de calcul s'appelle **CPM** (méthode du chemin critique). C'est pourquoi le bloc des résultats dans le panneau *Propriétés* s'appelle *Résultat CPM*.

## Comment l'application calcule

L'application ne recalcule pas le planning d'elle-même. Le calcul commence avec **Calculer** (F5), par exemple par *Accueil › Planification › Calculer*. Si quelque chose a changé depuis le dernier calcul, la barre d'état affiche *Obsolète — recalculer (F5)*. Si *Calculer automatiquement* est activé (sous *Paramètres › Projet › Paramètres de l'app*, onglet *Planification*, titre *Calcul*), l'application le fait elle-même.

Un calcul fait deux passages dans le réseau.

### Passe avant

L'application part du début du projet et suit les relations du prédécesseur vers le successeur. Pour chaque tâche, elle trouve le premier jour où la tâche peut commencer. Si une tâche a plusieurs prédécesseurs, elle attend la fin du dernier. Chaque tâche reçoit ainsi son **début au plus tôt** et sa **fin au plus tôt**. La plus tardive des fins au plus tôt de toutes les tâches est la fin du projet.

### Passe arrière

Ensuite, l'application remonte de cette date jusqu'au début du projet. Pour chaque tâche, elle trouve le dernier jour où la tâche doit être terminée sans décaler la fin du projet. Si une tâche a plusieurs successeurs, c'est celui qui doit commencer en premier qui compte. Cela donne le **début au plus tard** et la **fin au plus tard**.

### Marge totale et marge libre

La différence entre les dates au plus tard et au plus tôt d'une tâche est sa **marge totale** : le nombre de jours ouvrés dont la tâche peut prendre du retard ou commencer plus tard avant que la fin du projet ne bouge. L'application compte en jours ouvrés du calendrier de la tâche. Un week-end ou un jour férié ne compte pas.

La **marge libre** est plus stricte. C'est le temps dont dispose une tâche avant qu'un de ses successeurs doive commencer plus tard. Vous pouvez utiliser ce temps sans qu'aucune autre tâche le remarque.

La marge totale peut être partagée. Si deux tâches non critiques se suivent, elles partagent la même marge. Si la première l'utilise entièrement, la seconde n'en a plus. La première a alors une marge totale, mais pas de marge libre. La partie de la marge totale qui n'est pas libre s'appelle la **marge d'interférence** : si vous l'utilisez, les tâches suivantes bougent aussi. L'exemple ci-dessous le montre avec des chiffres.

### Marge négative

La marge peut aussi devenir négative. Cela arrive quand une tâche a une échéance, ou une contrainte qui impose une date au plus tard, qui tombe avant la date calculée par l'application pour cette tâche. Sur le papier, la tâche est déjà en retard, et la tâche ainsi que la chaîne qui la précède deviennent critiques.

### Quand une tâche est-elle critique ?

Par défaut, une tâche est critique quand sa marge totale est de 0 ou moins. Vous pouvez modifier cela sous *Paramètres › Projet › Paramètres du projet*, dans le bloc *Profil de calcul et options*, à *Options de calcul de ce projet*. Quand vous cliquez sur *Appliquer*, l'application recalcule le planning tout de suite. Les options font partie du fichier du projet, pas de l'application.

- **Définition de critique** avec *Marge totale ≤ seuil* et le champ *Seuil (jours ouvrés)*. Le seuil vaut 0 par défaut. Pour garder une réserve, réglez-le sur 2, par exemple : chaque tâche dont la marge est de 2 jours ouvrés ou moins compte alors comme critique et passe au rouge. Si vous choisissez *Chemin le plus long*, une tâche est critique quand elle se trouve sur le chemin le plus long jusqu'à la fin la plus tardive. Sa marge n'a alors pas d'importance.
- **Plusieurs chemins de marge** numérote les chaînes selon leur marge, dans la colonne *Chemin de marge*. Le chemin 1 est le chemin critique. Voir [Options de calcul et conventions](docs://ref-rekenopties-en-conventies).
- **Marquer quasi critique** avec son propre *Seuil*, 2 jours ouvrés par défaut. Une tâche dont la marge est supérieure à 0 mais au plus égale à cette valeur reçoit une barre orange. Cela montre quelles tâches n'ont presque plus de marge, sans les qualifier de critiques.
- **Tâches à extrémité ouverte critiques** : une tâche sans successeur, pas encore terminée, compte comme critique. Utile comme filet de sécurité contre les relations oubliées (voir les idées reçues ci-dessous).
- **Calcul de la marge** détermine si la marge totale se mesure au début de la tâche, à sa fin, ou comme la plus petite des deux. Les nouveaux projets sont réglés sur *Automatique (par défaut)*. Si le projet utilise le profil Primavera P6 et que ce choix n'est pas *Marge de fin*, un bloc orange dans les paramètres du projet le signale ; son bouton règle ce choix sur *Marge de fin*. Pour MS Project, le même bouton le remet sur *Automatique (par défaut)* : avec une date d'état, MS Project calcule lui-même de cette façon.

### Où le voir

Les tâches critiques ont une barre rouge dans le Gantt. Derrière une barre non critique, il y a une bande verte jusqu'à la fin au plus tard de la tâche : c'est la marge. La bande s'active ou se désactive avec *Affichage › Références et avancement › Bande de marge*.

Pour une tâche sélectionnée, le panneau *Propriétés* liste tout sous *Résultat CPM* : début et fin au plus tôt et au plus tard, marge totale, marge libre et marge d'interférence, et si la tâche se trouve sur le chemin critique. La marge de toutes les tâches côte à côte se trouve dans les colonnes sous *Calculé* (le **+** à droite de l'en-tête du tableau), comme *Marge totale*, *Marge libre*, *Critique* et *Quasi critique*.

La barre d'état en bas compte les tâches critiques, par exemple *Chemin critique : 21 tâches, 45 jours ouvrés*.

## Exemple détaillé : l'agrandissement de la maison

L'exemple est le projet d'entraînement des tutoriels, *House extension*, tel qu'il est une fois toutes les relations établies. Dans le tutoriel 2, « Relations et chemin critique », vous le construisez vous-même et vérifiez les chiffres. Ici, vous lisez pourquoi les chiffres sont ce qu'ils sont.

L'agrandissement commence le lundi 7 juin 2027. Après le calcul, la remise tombe le vendredi 6 août 2027 et la barre d'état affiche *Chemin critique : 21 tâches, 45 jours ouvrés*. Deux tâches ne sont pas critiques : *Build outer cavity leaf* et *Painting*.

### Deux chaînes qui se rejoignent

Après le plancher porteur (*Lay hollow-core floor*, terminé le lundi 28 juin), les tâches se divisent en deux chaînes. Les deux se terminent à *Install window frames* :

- L'intérieur : *Build inner cavity leaf* (5 jours ouvrés), puis *Place roof elements* (1), puis *Apply roofing* (2). Les châssis de fenêtre ne peuvent être posés qu'une fois la toiture fermée.
- L'extérieur : *Build outer cavity leaf* (6 jours ouvrés). Les châssis se trouvent dans la façade, donc celle-ci doit aussi être achevée.

**Passe avant.** Les deux parois peuvent commencer le mardi 29 juin. La paroi intérieure est terminée le lundi 5 juillet. Les éléments de toiture sont posés le mardi 6 juillet, et la couverture suit le mercredi 7 et le jeudi 8 juillet. La paroi extérieure est terminée le mardi 6 juillet. *Install window frames* attend la plus tardive des deux chaînes, la couverture, et commence donc le vendredi 9 juillet.

**Passe arrière.** Les châssis doivent commencer au plus tard le vendredi 9 juillet, sinon la remise se décale. La paroi extérieure doit donc être terminée au plus tard le jeudi 8 juillet. Six jours ouvrés en arrière, cela donne un début au plus tard le jeudi 1er juillet.

**Marge.** La paroi extérieure peut commencer au plus tôt le 29 juin et doit commencer au plus tard le 1er juillet. Entre les deux, il y a 2 jours ouvrés : le mercredi 30 juin et le jeudi 1er juillet. C'est sa marge totale ; le panneau affiche *Marge totale : 2 jours* et *Chemin critique : non*. La marge libre est également de 2 jours, parce que son seul successeur, *Install window frames*, se trouve sur le chemin critique.

La chaîne intérieure n'a pas de marge. Chaque jour de retard y décale les châssis et tout ce qui suit.

### Painting

*Painting* (3 jours ouvrés) commence après le plâtrage, le lundi 26 juillet, et se termine le mercredi 28 juillet. La tâche suivante, *Snagging and cleaning*, attend aussi le carrelage. Le carrelage n'est lui-même terminé que le jeudi 5 août, parce que la chape doit d'abord sécher pendant cinq jours ouvrés. La peinture peut donc se prolonger jusqu'au jeudi 5 août. Cela donne 6 jours ouvrés de marge : les 29 et 30 juillet, et les 2 à 5 août. Ici aussi, la marge libre égale la marge totale, parce que le successeur est critique.

### Quand la paroi extérieure prend du retard

Si la paroi extérieure prend 8 jours ouvrés au lieu de 6, elle se termine le jeudi 8 juillet : exactement sa fin au plus tard. La marge disparaît et la tâche passe au rouge. Les deux chaînes sont alors critiques et la barre d'état compte 22 tâches critiques. La remise reste le vendredi 6 août.

Si elle prend 9 jours ouvrés, la paroi extérieure n'est terminée que le vendredi 9 juillet. Les châssis passent au lundi 12 juillet et la remise au lundi 9 août : un jour ouvré plus tard. La chaîne extérieure est maintenant le chemin critique ; la barre d'état affiche *Chemin critique : 19 tâches, 46 jours ouvrés*.

La chaîne intérieure a alors 1 jour ouvré de marge totale, mais ce jour est partagé :

- *Build inner cavity leaf* : marge totale 1, marge libre 0, marge d'interférence 1. Si la paroi intérieure prend un jour de retard, les éléments de toiture se décalent avec elle.
- *Place roof elements* : marge totale 1, marge libre 0, marge d'interférence 1.
- *Apply roofing* : marge totale 1, marge libre 1. Seulement ici, un jour de retard ne coûte rien à personne.

C'est le même jour unique, partagé par toute la chaîne. Si la paroi intérieure l'utilise, il n'en reste plus pour les éléments de toiture et la couverture.

### Quasi critique et marge négative

Avec *Marquer quasi critique* activé au seuil par défaut de 2 jours ouvrés, la paroi extérieure, avec exactement 2 jours de marge, reçoit une barre orange. La peinture, avec 6 jours, reste bleue.

Si la remise reçoit une échéance le mercredi 4 août, deux jours ouvrés avant la remise calculée, la marge devient négative. Les 21 tâches du chemin critique reçoivent une marge totale de −2 jours ouvrés. La paroi extérieure n'a plus de marge et devient aussi critique ; la peinture conserve 4 jours ouvrés.

## Conséquences et idées reçues

**« Critique veut dire important. »** Non. Une inspection peut être décisive et pourtant avoir de la marge. Dans l'autre sens, une tâche simple peut être critique : dans l'exemple, *Snagging and cleaning* se trouve sur le chemin critique. Critique ne concerne que le temps : il ne reste aucune marge.

**« Cette tâche a de la marge, elle peut donc attendre. »** Regardez d'abord la marge libre. Si une tâche a une marge totale mais pas de marge libre, chaque jour de retard retire de la marge aux tâches suivantes, comme avec la paroi intérieure dans le cas de 9 jours ouvrés.

**Une relation oubliée donne une fausse marge.** Une tâche sans successeur reçoit une marge jusqu'à la fin du projet. Si l'exemple n'avait pas la relation entre la paroi extérieure et les châssis, la paroi extérieure aurait soudain 23 jours ouvrés de marge, jusqu'à la remise du 6 août. Sur le papier, elle pourrait alors prendre des semaines de retard sans que les châssis attendent. Avec *Tâches à extrémité ouverte critiques* activé, la paroi extérieure devient critique dans ce cas, et le manque apparaît.

**Le chemin critique n'est pas fixe.** Si une tâche non critique prend plus de retard que sa marge, une autre chaîne devient la plus longue. Vous l'avez vu plus haut avec 9 jours de maçonnerie. Le planning doit donc être recalculé après chaque modification. Tant que la barre d'état affiche *Obsolète — recalculer (F5)*, les barres rouges appartiennent encore au calcul précédent.

**La marge se compte en jours ouvrés.** Les 6 jours ouvrés de marge de la peinture vont du jeudi 29 juillet au jeudi 5 août : huit jours dans l'agenda, car le week-end ne compte pas. Un jour férié ou des congés du bâtiment dans le calendrier ne comptent pas non plus.

## Voir aussi

- [Ajouter des relations](docs://howto-relaties-leggen) : les étapes pour lier des tâches et régler un décalage.
- [Relations et décalage](docs://uitleg-relaties) : comment les relations et le décalage déterminent les débuts au plus tôt.
- [Contraintes et échéances](docs://uitleg-constraints) : comment une contrainte ou une échéance produit une marge négative.
- [Suivre un chemin](docs://howto-pad-traceren) : suivre la chaîne qui précède une tâche.
- [Options de calcul et conventions](docs://ref-rekenopties-en-conventies) : la définition du critique, le quasi critique et le calcul de la marge, option par option.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc) : un grand projet avec plusieurs chemins de marge, des travaux quasi critiques (seuil de 3 jours ouvrés), un hamac, une date fixe impérative et une relation externe.
