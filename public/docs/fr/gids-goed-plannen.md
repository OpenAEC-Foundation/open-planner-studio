# Bien planifier

Qu'est-ce qui fait un bon planning ? Ce n'est pas son aspect soigné qui compte, mais le fait qu'il réponde à la question qui se pose une fois les travaux commencés : si cela prend du retard, qu'est-ce que cela change pour la remise ? Cet article explique les principes d'un planning fiable, et pourquoi ils comptent autant dans Open Planner Studio : l'application calcule avec ce que vous saisissez, et avec rien d'autre.

Les exemples viennent du bâtiment : gros œuvre, second œuvre, délais d'approvisionnement, retard dû à la météo, sous-traitants, une date de remise contractuelle. Mais les principes eux-mêmes ne sont pas propres au bâtiment.

## Le concept

Un bon planning n'est pas une image de ce que vous espérez, mais un **modèle de calcul** : des tâches avec une durée, reliées par des relations, dans un calendrier. L'application calcule les dates à partir de ce modèle. Quand quelque chose change, le modèle recalcule et vous voyez tout de suite ce que cela signifie pour la suite.

Un planificateur travaille dans un ordre fixe :

1. L'objectif : jalons et date de remise.
2. La décomposition : phases, lots de travaux, tâches.
3. La durée de chaque tâche.
4. Les relations.
5. Les contraintes et les dates fixes.
6. Les calendriers.
7. Les ressources.
8. Le chemin critique et les marges.
9. La référence et l'avancement.
10. La revue.

Cet ordre n'est pas une simple convention. Si vous sautez une étape, elle revient plus tard comme une mauvaise surprise : les tâches sans relations ne se décalent pas avec les autres, les durées sans calendrier sont fausses, et une référence que vous n'enregistrez qu'ensuite fige le retard au lieu de l'accord.

## Comment l'application calcule avec cette approche

Chaque principe ci-dessous est lié à une action de l'application. C'est pourquoi cette partie suit le même ordre.

### Partir de l'objectif, pas des tâches

Notez d'abord les moments fixes, et seulement ensuite les tâches qui doivent tenir entre eux : début de la préparation du chantier, permis définitif, hors d'eau, début des finitions, remise. Ce sont des **jalons** : des points sans durée. Saisissez-les vraiment comme jalon (*Accueil › Tâches › Jalon ▾*) et non comme une tâche de durée nulle portant un nom qui y ressemble.

Pourquoi cet ordre : un planning qui part d'une liste de tâches devient une somme, et une somme tombe rarement sur la date du contrat. Partez des jalons, et la bonne question se pose tout de suite : non pas « combien de temps prend l'ensemble ? », mais « les tâches tiennent-elles entre ces deux moments, et sinon, que faut-il changer ? ». Remontez depuis la date de remise exigée jusqu'au moment où le bâtiment doit être hors d'eau au plus tard, puis jusqu'au début.

Une remise fixée par contrat reçoit la case à cocher *Obligatoire (contractuel)*. Ainsi, toute personne qui ouvre le fichier voit que ce moment n'est ni négociable ni déplaçable. La case à cocher sert de repère pour le Gantt et les rapports ; elle ne protège pas une date. Pour cela, utilisez une échéance ou une contrainte (voir ci-dessous).

### La décomposition : phases, lots de travaux, tâches

Sous les jalons, vous construisez la structure : des phases, sous elles des lots de travaux, sous ceux-ci des tâches. Vous le faites en mettant en retrait. Une tâche avec des sous-tâches devient automatiquement une **tâche récapitulative** : l'application déduit sa barre et sa durée des tâches situées en dessous. N'entrez donc jamais vous-même une durée pour une tâche récapitulative.

La règle empirique pour le niveau de détail : **une tâche dure entre environ un jour et deux semaines**. Plus court qu'un jour : vous planifiez le détail d'exécution au lieu du projet. Cela relève du planning hebdomadaire du chef de chantier, pas d'un modèle de calcul qui doit tenir des mois. Plus long que deux semaines : c'est une tâche que vous ne pouvez pas estimer correctement et que vous ne pouvez pas suivre pendant l'exécution. « finishing ground floor, 40 days, 45% complete » ne dit à personne si les choses vont bien. Les revues de planning relèvent donc souvent le nombre de tâches qui durent plus d'environ deux mois ; au-delà de quelques pour cent, cela compte comme un manque de détail.

Trop fin nuit autant que trop grossier. Chaque tâche coûte de l'entretien : des relations à tracer, un avancement à saisir, un nouveau jugement après chaque modification. Un planning de deux mille tâches pour un projet de six mois ne devient pas plus précis : il devient impossible à entretenir. Et un planning que personne ne met à jour est une fiction en trois semaines. Choisissez le niveau auquel vous pouvez rendre compte honnêtement de l'avancement, chaque semaine.

En pratique : « 3. Finishing » est une phase, « Finishing house 4 » un lot de travaux, « Plastering house 4 ground floor » une tâche de cinq jours. Vous pouvez délibérément dépasser la limite supérieure pour les délais de livraison et la surveillance : la livraison de châssis de fenêtres en dix semaines est vraiment un bloc d'attente indivisible, et la surveillance continue relève d'un hamac plutôt que d'une série de tranches artificielles.

### Estimer la durée

Une durée est une estimation du temps que prend le travail, pas de la vitesse maximale possible. Estimez pour une journée normale avec l'équipe que vous aurez réellement, et non pour la meilleure journée avec la meilleure équipe. L'optimisme se cumule le long de la chaîne : un planning dans lequel chaque tâche suppose la meilleure journée n'atteint presque jamais sa date de remise.

Jours ou heures est un vrai choix, pas une question de mise en forme. Choisissez **jours** pour le travail qui donne le rythme sur le chantier : maçonnerie, plâtrage, carrelage. Cela prend cinq jours, qu'une journée dure huit ou neuf heures. Choisissez **heures** quand les heures sont l'unité elle-même et que le reste de la journée compte : une inspection de trois heures, un coulage de béton de quatorze heures réparti sur deux jours, un travail en équipes. L'application enregistre ce choix par tâche. Vous ne trouvez ce choix qu'après avoir d'abord activé *Activer la planification horaire* : voir [Jours et heures](docs://uitleg-dagen-en-uren).

Ne cachez pas le risque dans les durées individuelles. Ajouter un jour partout enfouit la marge : plus personne ne peut la voir ni la piloter. Et là où la marge était vraiment nécessaire, elle se révèle trop petite. Rendez la réserve visible : une tâche tampon explicite avant la date de remise, ou une provision séparée pour la météo. Attention au double comptage. Les environ 180 jours ouvrés exploitables par an, sur lesquels le bâtiment néerlandais compte, sont un chiffre annuel contractuel (UAV), duquel les jours fériés, les congés du bâtiment *et* les jours perdus ont déjà été déduits. Si les jours fériés et les congés du bâtiment figurent déjà dans votre calendrier de projet, il ne reste que le retard dû à la météo comme élément séparé. Le retard dû au gel et aux tempêtes suit ses propres règles dans la convention collective Onwerkbaar weer Bouw & Infra. Inscrivez ces jours perdus prévus dans le calendrier ou dans un élément séparé, et non caché dans la durée de la maçonnerie.

### Relations : sans réseau, ce n'est pas un planning

L'application calcule les dates le long des **relations** : une tâche ne démarre que lorsque ses prédécesseurs le permettent. Une tâche sans relation n'est liée à rien. Si le gros œuvre glisse de deux semaines, une tâche de finitions non reliée ne suit pas, et le planning ment sans que rien ne passe au rouge.

C'est pourquoi chaque tâche reçoit au moins un prédécesseur et au moins un successeur. Seules la première tâche du projet et le dernier jalon en sont dispensés. Dans une revue de planning, c'est le premier contrôle : pas plus de quelques pour cent des tâches ne peuvent avoir une logique manquante.

**La relation fin-début est la valeur par défaut**, et elle doit le rester : fondations terminées, puis gros œuvre. Dans un planning de construction sain, environ neuf relations sur dix sont fin-début. C'est une exigence de lisibilité : fin-début est le seul type que tout le monde sur le chantier comprend sans explication, et il se comporte de façon prévisible pendant l'exécution.

**Début-début avec décalage** sert pour les travaux qui se déroulent réellement en parallèle, et non en attendant. Le cas classique : une rangée de maisons mitoyennes ou une tour avec des étages. L'installateur suit la maçonnerie avec trois jours de retard. C'est un début-début avec un décalage de trois jours, et non un fin-début sur une tâche artificiellement découpée. Placez à côté une relation fin-fin, sinon le successeur pourrait en théorie finir avant son prédécesseur. Dans le bâtiment, on n'utilise presque jamais le début-fin.

Tracez de préférence ce début-début entre des tâches, et non entre des phases. Si le prédécesseur d'un début-début ou d'un début-fin est une phase, l'application fait attendre le successeur sur la tâche de cette phase qui commence **en dernier**, et non sur la première. Ainsi, il ne planifie jamais trop tôt, mais parfois plus tard que vous ne le vouliez. Fin-début et fin-fin avec une phase comme prédécesseur attendent que la dernière tâche de cette phase soit terminée, et c'est en général exactement ce que vous voulez dire.

Limitez les décalages, et surtout les décalages négatifs. Un décalage est un temps d'attente sans raison visible : plus tard, personne ne peut dire pourquoi il y a sept jours entre les deux. S'il s'agit du durcissement du béton, faites-en un décalage en jours calendaires (le béton durcit aussi le week-end), ou mieux encore, une vraie tâche « curing » que tout le monde peut voir et suivre. Un décalage négatif — une avance, un chevauchement — ne devrait vraiment pas exister ; dans une revue de planning, la norme est zéro. Si vous voulez un chevauchement, découpez le prédécesseur ou utilisez un début-début.

### Contraintes et dates fixes : le moins possible

Chaque tâche part au départ « dès que possible », et dans la très grande majorité des cas, elle doit le rester. Une **contrainte** est une limite de date, en plus des relations. Plus vous en ajoutez, moins votre planning se calcule et plus il devient un simple dessin. Un planning plein de dates fixes semble stable et cache justement le risque : il ne bouge plus, donc il n'avertit plus.

N'utilisez une contrainte que pour une date externe stricte, sur laquelle le planning lui-même n'a aucune influence : le permis qui ne sera pas définitif avant le 1er mars (*Début au plus tôt le (SNET)*), la fenêtre de fermeture accordée par la commune, la date de raccordement de la compagnie de distribution. « Je veux cette tâche en mai » n'est pas un fait externe ; vous le réglez par la logique ou par une autre durée. En règle empirique, pas plus de quelques pour cent des tâches restantes ne portent une limite de date stricte.

N'entrez jamais une date de début pour placer une tâche. Pour une tâche avec un prédécesseur, l'application transforme un début saisi (ou glissé) en contrainte *Début au plus tôt le (SNET)*. La tâche est alors là où vous la voulez, et elle y reste même quand toute la chaîne qui la précède prend du retard.

Si vous voulez suivre une date sans diriger le calcul, utilisez une **échéance**. Elle ne déplace rien, mais elle donne une marge négative et un avertissement dès que la tâche ne la respecte plus : exactement le signal que vous voulez voir. Gardez une contrainte stricte (*Obligatoire (logique de verrouillage)*) pour le cas extrême, et sachez alors qu'elle donne une marge négative dans la chaîne qui la précède : c'est le planning qui signale que cela ne rentre pas, et non que quelque chose est cassé.

### Calendriers : d'abord le projet, puis les exceptions

Toutes les durées se comptent en jours ouvrés ou en heures ouvrées d'un calendrier. Configurez donc correctement le calendrier du projet avant de saisir des durées : jours ouvrés, horaires de travail, jours fériés et congés du bâtiment. Un calendrier que vous corrigez à mi-parcours décale tout votre planning. Ajoutez tout de suite les fermetures prévisibles : la saison de gel pendant laquelle vous ne coulez pas de béton, la fermeture de l'entreprise entre Noël et le Nouvel An.

Donnez à une ressource son propre calendrier seulement si elle diffère vraiment : le façadier qui ne vient que quatre jours par semaine, l'équipe qui prend d'autres congés d'été. Un calendrier de ressource ne modifie aucune date d'une tâche ; celle-ci continue à suivre le calendrier de la tâche ou du projet. Il montre seulement que la ressource ne travaille pas un des jours ouvrés de la tâche, sous forme de surallocation dans l'histogramme. Cette différence est difficile à repérer si vous ne savez pas que vous l'avez créée vous-même.

### Ressources : qui fait le travail, et est-ce possible ?

Un planning sans ressources ne répond qu'à la moitié de la question. Dès que vous affectez les équipes et le matériel, l'histogramme montre ce qu'une seule chronologie ne montre pas : que le 14 juin, vous avez besoin de trois équipes de plâtriers alors que vous en avez deux.

Commencez par les ressources qui limitent. Il n'est pas nécessaire d'inscrire chaque vis ; la grue à tour, vos propres équipes, les sous-traitants dont la capacité est plafonnée et les délais de livraison longs doivent y figurer. Donnez à chaque ressource une capacité honnête : deux plâtriers signifie deux, et non « deux, mais trois en cas d'urgence ».

Lisez l'histogramme comme une question, et non comme une erreur. Le rouge au-dessus de la ligne signifie que le planning demande plus que ce que vous avez ce jour-là. Parfois, la réponse est : décaler. Souvent, la réponse est : cela ne marchera pas, et c'est ce que je voulais savoir. Le **nivellement** décale les tâches jusqu'à ce que la demande rentre dans la capacité. Si la date de fin peut encore glisser, acceptez-le ; si la date de remise est fixe, nivelez uniquement dans la marge (la case à cocher *Niveler uniquement dans la marge (lissage) — la date de fin de projet reste fixe*). La date de fin reste alors en place, et il vous reste un conflit signalé, ce qui est un résultat plus honnête qu'un planning qui n'a que l'air résolu.

Ne nivelez *pas* quand la demande est structurellement supérieure à la capacité. Le nivellement réorganise le travail existant dans le temps ; il n'embauche pas de plâtriers supplémentaires et ne construit pas une deuxième grue. Trois tours qui demandent la même équipe au même moment restent trois tours qui demandent la même équipe après le nivellement ; la seule chose qui change est que la remise recule. Ce qui aide alors, c'est le phasage, une capacité supplémentaire ou un travail différent. Ne nivelez pas non plus avant que votre logique et vos durées soient en place : vous nivèleriez un planning qui sera différent demain.

### Chemin critique et marge : où le planning est vulnérable

L'application ne recalcule pas à chaque modification. Calculez avec **Calculer** (F5), et lisez seulement ensuite. Si la barre d'état affiche *Obsolète — recalculer (F5)*, vous regardez le calcul précédent, et non celui-ci. Avec le paramètre *Calculer automatiquement*, l'application le fait elle-même.

Le **chemin critique** est la chaîne sans marge : chaque jour perdu y repousse la remise d'un jour. C'est là que doivent aller votre suivi et vos meilleurs collaborateurs. Ne regardez pas seulement le rouge. La **marge totale** indique de combien une tâche peut prendre du retard sans toucher la remise ; la **marge libre** indique de combien elle peut prendre du retard sans décaler son successeur. La différence ne change la date de fin de personne, mais elle gêne quelqu'un : c'est utile quand vous travaillez avec des sous-traitants que vous ne pouvez pas replanifier deux fois.

Surveillez trois signaux. Une tâche avec quelques jours de marge n'est pas une tâche sûre, mais une tâche quasi critique ; avec *Marquer quasi critique*, ces tâches reçoivent leur propre couleur. Une tâche avec une marge extrême — dans les revues de planning, plus de 44 jours ouvrés, environ deux mois — manque presque toujours d'un successeur ; cela vous indique directement les trous dans votre réseau. Et une marge négative n'est jamais une erreur de calcul : c'est le planning qui signale qu'une échéance ou une date fixe ne rentre pas.

### Référence avant le début, puis la mettre à jour

Enregistrez une **référence** dès que le planning est approuvé, et avant le premier coup de pelle (*Planification › Références et avancement › Gérer les références…*). Calculez d'abord : la référence conserve les dates du dernier calcul. Sans cette référence, vous ne pouvez que constater, après coup, *que* les choses se passent autrement, mais pas de combien ni depuis quand. C'est exactement ce dont vous avez besoin lors d'une réunion de chantier, pour des travaux supplémentaires et quand un retard est discuté.

Une référence enregistre les dates, mais pas les hypothèses qui les sous-tendent, et ce sont justement ces hypothèses que l'on demande dès qu'un retard est discuté. Donc, lorsque vous l'enregistrez, notez brièvement sur quoi ce planning repose (dans la pratique du planning : la *base du planning*) : quels rendements vous avez utilisés, quel calendrier et pourquoi il est réglé ainsi, ce que vous avez volontairement laissé de côté, qui a fourni les délais que vous avez supposés, et qui a approuvé le planning. Une demi-page suffit.

Ensuite, garder le planning à jour est un rythme, pas un projet. Mettez à jour chaque semaine, dans le même ordre : réglez la **date d'état** sur la date du rapport, saisissez le début réel et la fin réelle de ce qui a commencé et de ce qui est terminé, corrigez la durée restante de ce qui est en cours, puis calculez. Un pourcentage seul ne suffit pas : les dates réelles sont le relevé factuel que l'on examinera plus tard.

Sachez ce que fait la date d'état : les tâches pas encore commencées sont déplacées par l'application à la date d'état, et les tâches qui suivent les accompagnent (sauf dans le profil de calcul Microsoft Project). Donc, si vous oubliez de valider une tâche ou un jalon terminé, il se déplace tout seul vers la droite. Ce n'est pas une erreur : le modèle refuse de faire comme si quelque chose du passé pouvait encore se produire. Si vous obtenez un avertissement *Hors séquence*, le travail a été fait dans un autre ordre que celui que prescrit la logique ; c'est en général une raison de revoir l'enchaînement, et non de faire disparaître l'avertissement en cliquant dessus. N'enregistrez une nouvelle référence que pour un vrai changement de périmètre, et alors à côté de la première, et non pas la remplacer.

Enfin : un planning n'est fiable que si les personnes qui font le travail y croient. Faites confronter le planning hebdomadaire à ce modèle par le chef de chantier et les sous-traitants. Si, semaine après semaine, vous n'atteignez que la moitié de ce qui a été convenu, le problème vient plus souvent du planning que de l'exécution.

## Exemple détaillé : trois choix qui faussent discrètement le planning

Les chiffres viennent de deux exemples traités ailleurs dans l'aide : le projet d'exercice *House extension* des tutoriels, et un petit réseau pour un agrandissement. Ici, l'important est ce que chaque choix fait à votre planning. Vous essayez vous-même dans le tutoriel 2 (relations et chemin critique) et dans le tutoriel 3 (une contrainte et une échéance).

### Une relation oubliée

Dans l'agrandissement, les travaux commencent le lundi 7 juin 2027 et la livraison a lieu le vendredi 6 août. *Build outer cavity leaf* (6 jours ouvrés) a pour successeur *Install window frames*, car les châssis se trouvent dans la façade. Avec cette relation, la paroi extérieure a 2 jours ouvrés de marge.

Si vous oubliez cette relation, la paroi extérieure a soudain 23 jours ouvrés de marge, jusqu'à la livraison. Sur le papier, elle peut prendre des semaines de retard sans que personne n'attende. Rien ne passe au rouge et aucun avertissement n'apparaît. Ce n'est qu'avec l'option de calcul *Tâches à extrémité ouverte critiques* qu'une tâche sans successeur devient critique, et l'écart ressort alors.

### Une date saisie à la place d'une relation

Le petit réseau : *Groundwork* (3 jours ouvrés), *Pour foundation* (2), *Brickwork* (5) et *Roofing* (3), l'une après l'autre, à partir du lundi 7 juin 2027. Le projet est terminé le mercredi 23 juin.

Si vous saisissez un début lundi 21 juin pour *Brickwork*, parce que les briques n'arrivent qu'à ce moment-là, cela devient un *début au plus tôt*. *Brickwork* se décale d'une semaine et le projet est terminé le mercredi 30 juin. *Groundwork* et *Pour foundation* obtiennent 5 jours ouvrés de marge et ne sont plus critiques. Si les briques arrivent finalement plus tôt, *Brickwork* reste au 21 juin : c'est maintenant la date qui pilote, et non la logique.

Si vous saisissez à la place le mercredi 9 juin, avant la fin des fondations, rien ne se passe : les relations ne laissent de toute façon *Brickwork* commencer que le lundi 14 juin.

### Une échéance à la place d'une contrainte

Si vous voulez que *Roofing* soit terminée le vendredi 18 juin, placez-y une échéance. Rien ne bouge : *Roofing* reste du lundi 21 au mercredi 23 juin. Mais la chaîne obtient −3 jours ouvrés de marge, et l'application affiche *Échéance 18-06-2027 dépassée — fin au plus tôt 23-06-2027*. Vous voyez donc tout de suite que l'engagement ne tient pas. Une barre au bon endroit, avec une chaîne derrière qui ne le permet pas, ne vous le dirait pas.

## Conséquences et idées fausses

- **Tâches sans prédécesseur ni successeur.** Les plus courantes, et les plus nuisibles : ces tâches ne suivent pas le reste et donnent une fausse marge.
- **Saisir des dates ou déplacer des barres au lieu de dessiner la logique.** Cela fixe discrètement une contrainte.
- **Trop de contraintes, et une contrainte fixe utilisée comme signet.** Le planning ne calcule alors plus : il ne fait que dessiner.
- **Tâches de trois mois, ou tâches d'une demi-journée.** La plage utilisable se situe à peu près entre un jour et deux semaines.
- **Durées optimistes, et marge cachée dans chaque tâche** au lieu d'un tampon visible.
- **Retards dus à la météo et congés du bâtiment absents du calendrier.** Ils finiront de toute façon par y figurer en janvier.
- **Décalages au lieu de tâches.** Sept jours d'attente sans nom restent inexplicables trois mois plus tard.
- **Nivellement avant que la logique soit en place**, ou poursuite du nivellement malgré un manque structurel de capacité.
- **Oublier de calculer.** *Périmé* dans la barre d'état signifie que vous regardez le calcul précédent.
- **Pas de référence, ou une référence enregistrée seulement après le début.**
- **Avancement saisi uniquement en pourcentage**, sans dates réelles et sans date d'état.
- **Fermer le panneau *Avertissements* sans le lire.** C'est là que se rassemblent les échéances manquées, les contraintes violées, les relations hors séquence et les ressources en surallocation (*Planning › Planning › Avertissements*).

## Voir aussi

- [Chemin critique et marge](docs://uitleg-kritiek-pad) : comment l'application calcule les dates au plus tôt, les dates au plus tard et la marge.
- [Relations et décalage](docs://uitleg-relaties) : les quatre types de relation, le décalage et les relations sur une phase.
- [Contraintes et échéances](docs://uitleg-constraints) : ce que chaque contrainte et une échéance font au calcul.
- [Calendriers et jours ouvrés](docs://uitleg-kalenders) : comment l'application compte les jours ouvrés et quel calendrier l'emporte.
- [Jours et heures](docs://uitleg-dagen-en-uren) : planifier en jours, en heures ou en mode mixte.
- [Nivellement des ressources](docs://uitleg-nivelleren) : ce que le nivellement déplace et ce qu'il ne déplace pas.
- [Avancement, date d'état et référence](docs://uitleg-voortgang) : ce que fait la date d'état et comment lire l'écart.
- [Ajouter des tâches et des jalons](docs://howto-taken-en-mijlpalen-toevoegen) : saisir les jalons et les tâches.
- [Ajouter des relations](docs://howto-relaties-leggen) : lier les tâches entre elles.
- [Connecter un assistant IA (MCP)](docs://howto-ai-assistent-koppelen) : un assistant qui planifie selon ces principes.
- [Notifications et avertissements](docs://ref-meldingen) : tous les avertissements au même endroit.
