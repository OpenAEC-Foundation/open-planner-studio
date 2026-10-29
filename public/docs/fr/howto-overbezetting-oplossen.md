# Résoudre une surallocation

Objectif : voir à quel jour une ressource a trop à faire et résoudre ce problème, en général en nivelant les tâches.

## Quand vous en avez besoin

Sur le papier, votre planning fonctionne. Mais le maçon est affecté à deux murs qui se font les mêmes jours. L'application appelle cela une **surallocation**. Une ressource est en surallocation un jour ouvré si le planning lui demande, ce jour-là, plus que sa capacité (*Unités max*). Elle est aussi en surallocation si elle ne travaille pas ce jour-là selon son calendrier.

Commencez par chercher la surallocation. Choisissez ensuite une solution. Le **nivellement** est la solution que l'application calcule pour vous : elle fait commencer les tâches plus tard, jusqu'à ce que la ressource puisse suivre. Pour savoir comment ce calcul se fait, lisez [Nivellement des ressources](docs://uitleg-nivelleren).

## Étapes

### 1. Trouver la surallocation

1. Regardez dans le ruban *Ressources › Surallocation*. Il affiche *Aucune* ou, en rouge, le nombre de ressources en surallocation, par exemple *1 ressource*. Après un calcul, la barre d'état affiche aussi *⚠ 1 ressource(s) en surallocation*.
2. Cliquez sur ce message dans la barre d'état. Le panneau *Avertissements* s'ouvre à droite, avec une ligne pour chaque ressource, par exemple *Bricklayer* avec *Surallocation sur 5 jour(s) (29-06-2027 – 05-07-2027)*.
3. Cliquez sur cette ligne. L'application active l'histogramme, choisit la ressource et sélectionne toutes les tâches affectées à la ressource.
4. Regardez l'histogramme sous le Gantt. Les barres rouges sont les jours en surallocation. Si vous passez la souris sur un jour, vous voyez quelles tâches y contribuent, par exemple *2 tâches contribuent le 2027-06-30* avec leurs noms dessous.

Vous pouvez aussi activer l'histogramme vous-même avec *Ressources › Histogramme › Histogramme*. Choisissez une ressource dans la liste à gauche, ou parcourez les ressources avec *Précédent* et *Suivant*. Un point rouge dans la liste signifie que cette ressource est en surallocation. La ligne *Toutes les ressources* additionne les ressources, sans le matériel.

Si une tâche est sélectionnée, l'histogramme montre seulement la charge de cette tâche et seulement les ressources qui y sont affectées. Appuyez sur Esc pour effacer la sélection et voir à nouveau tout le projet.

### 2. Choisir une solution

- **Plus de capacité.** Si un deuxième maçon arrive vraiment, réglez *Unités max* sur 2 (voir [Gérer les ressources](docs://howto-resources-beheren)). La surallocation disparaît alors.
- **Moins d'unités par jour.** Baissez les *Unités* ou choisissez une autre courbe pour l'affectation (voir [Affecter des ressources avec une courbe](docs://howto-resource-toewijzen)).
- **Mettez les tâches l'une après l'autre.** Ajoutez une relation entre les deux tâches, pour que la seconde ne commence qu'une fois la première terminée (voir [Ajouter des relations](docs://howto-relaties-leggen)).
- **Nivellement.** L'application fait commencer une tâche plus tard.

### 3. Niveler

1. Vérifiez que le planning a été calculé avec **Calculer** (F5), par exemple via *Accueil › Planification › Calculer*.
2. Choisissez *Ressources › Nivellement › Niveler…*. La fenêtre *Niveler les ressources* s'ouvre.
3. Décidez si la date de fin du projet peut bouger. Si vous laissez la case *Niveler uniquement dans la marge (lissage) — la date de fin de projet reste fixe* décochée, la date de fin peut changer. Si vous la cochez, l'application ne déplace les tâches que dans leur marge.
4. Sous *Ressources* se trouvent les ressources qui seront nivelées. Par défaut, toutes les ressources sont cochées, sauf le matériel. Décochez une ressource que vous voulez laisser telle quelle.
5. Cliquez sur *Calculer*. Pendant le calcul, il affiche *Calcul en cours…*, et vous pouvez l'arrêter avec *Arrêter*. Le planning ne change pas encore : c'est une proposition.
6. Lisez la proposition. En haut se trouve la date de fin, par exemple *Date de fin de projet : inchangée (30-08-2027)* ou *Date de fin de projet : 25-08-2027 → 30-08-2027*. En dessous se trouve un tableau avec, pour chaque tâche, l'*Ancien début*, le *Nouveau début* et les *Jours de décalage*, par exemple *Build outer cavity leaf*, 29-06-2027, 06-07-2027 et *5 j*.
7. Choisissez *Appliquer*. L'application écrit les retards dans les tâches et recalcule tout de suite le planning. Appuyer sur F5 n'est pas nécessaire. *Annuler* ferme la fenêtre sans changement.
8. Vérifiez *Ressources › Surallocation*. Il affiche maintenant *Aucune*.

Si vous modifiez une option dans la fenêtre après avoir cliqué sur *Calculer*, la proposition disparaît. Cliquez alors à nouveau sur *Calculer*. Si le planning change pendant que l'application calcule, elle affiche *Le planning a changé pendant le calcul. Cliquez à nouveau sur Calculer.*

### Choisir la tâche qui reste en place

L'application place les tâches une par une. Les tâches placées en premier restent à leur place. Les tâches avec la priorité la plus haute passent en premier. À priorité égale, la tâche avec la marge la plus petite passe en premier.

Si vous voulez décider vous-même quelle tâche reste en place, donnez-lui une priorité plus haute. Faites un clic droit sur la barre de la tâche dans le Gantt et choisissez *Priorité*, puis *Basse* (100), *Normale* (500) ou *Haute* (900). *Normale* est la valeur par défaut. Vous pouvez aussi saisir vous-même un nombre de 0 à 1000 dans la colonne *Priorité de nivellement* : cliquez sur le **+** à droite de l'en-tête du tableau des tâches (*Ajouter une colonne*) et choisissez cette colonne sous *Planification*. Plus le nombre est élevé, plus la tâche a de chances de rester en place. L'application n'accepte pas un nombre supérieur à 1000. Une tâche de priorité 1000 ne bouge jamais à cause de la capacité.

### Annuler et rétablir

- *Annuler* (Ctrl+Z) annule *Appliquer* en une seule étape.
- *Ressources › Nivellement › Effacer le nivellement* supprime tout le nivellement des tâches. Le bouton est grisé tant qu'il n'y a pas de nivellement. La surallocation qui revient ainsi est simplement de nouveau là.
- Si vous avez modifié le planning depuis, choisissez simplement *Niveler…* à nouveau. L'application repart alors de zéro : les anciens retards ne comptent pas.

## Pièges et ce que fait l'application alors

**Pas encore calculé.** Si le planning n'a pas été calculé, la fenêtre affiche *Calculez d'abord la planification (F5) avant de niveler.* et *Calculer* n'est pas disponible.

**Conflits restants.** Toutes les surallocations ne se résolvent pas par décalage. Les tâches concernées sont listées sous *Conflits restants*, avec le nombre de jours et la raison :

- *Capacité libre insuffisante dans la marge pour résoudre ce conflit.* Vous voyez cela avec le *lissage* : dans la marge de la tâche, aucun moment n'est libre. Décochez la case et la date de fin peut bouger.
- *La ressource ne travaille pas tous les jours nécessaires à cette tâche — le décalage ne résout pas ce problème.* La ressource a des jours non travaillés dans son propre calendrier, au milieu de la tâche. Modifiez le calendrier ou la tâche.
- *Bricklayer atteint un pic de 2 unités/jour, la capacité est de 1 — ne peut pas être résolu en décalant.* Par sa courbe, la tâche seule demande, un jour donné, plus que la ressource ne peut fournir. Choisissez une autre courbe ou réduisez les unités.

**Elle affiche** *Aucune tâche ne doit être déplacée — la planification est déjà sans conflit.* Si cette ligne apparaît avec la liste *Conflits restants* dans la proposition, fiez-vous à la liste. La ligne indique seulement qu'il n'y a rien à décaler. Si la ligne apparaît sans liste, alors que *Ressources › Surallocation* signale encore une ressource, toutes les tâches en conflit sont fixées à la priorité 1000 ou ont déjà commencé. Elles ne bougent pas, et la fenêtre ne les signale pas comme conflit. Après avoir appliqué, regardez donc toujours *Surallocation*.

**Tâches qui ne se décalent pas.** Une tâche déjà commencée ou terminée ne se décale jamais. Sa charge compte quand même. Les jalons et les phases ne se décalent pas non plus.

**Le matériel n'est pas nivelé.** Si une ressource matérielle demande plus que ses *Unités max* un jour, elle compte bien en surallocation dans *Surallocation*, mais elle n'apparaît pas dans la fenêtre de nivellement.

**Le nivellement ne s'adapte pas.** Les retards restent tels qu'ils ont été calculés. Si vous modifiez ensuite la durée d'une tâche, une tâche nivelée reste à sa place, même si cette place n'est plus nécessaire. Relancez alors le nivellement.

**Surallocation à cause du calendrier.** Si la ressource ne travaille pas un jour selon son calendrier, le panneau *Avertissements* affiche par exemple *Surallocation sur 5 jour(s) (29-06-2027 – 05-07-2027), dont 1 jour(s) où la ressource ne travaille pas selon son calendrier*. Si une tâche traverse toujours un tel jour, ce qui est la deuxième raison ci-dessus, le nivellement ne résout pas ce problème.

## Voir aussi

- [Nivellement des ressources](docs://uitleg-nivelleren) : ce que le nivellement décale, dans la marge et au-delà, et ce qu'il ne fait pas.
- [Gérer les ressources](docs://howto-resources-beheren) : régler la capacité et le calendrier d'une ressource.
- [Ajouter des relations](docs://howto-relaties-leggen) : mettre des tâches l'une après l'autre.
- [Notifications et avertissements](docs://ref-meldingen) : l'avertissement de surallocation dans le panneau Avertissements.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) : les plâtriers sont en surallocation pendant 5 jours. Avec *Niveler uniquement dans la marge (lissage) — la date de fin de projet reste fixe* activé, la fin reste au 17 août 2027 et il reste un conflit. Avec la case désactivée (par défaut), tout est résolu et la fin passe au 24 août 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc) : la grue à tour est en surallocation pendant 65 jours et les plâtriers pendant 15 jours. Avec la case *Niveler uniquement dans la marge (lissage) — la date de fin de projet reste fixe* désactivée, le nivellement repousse la fin du 9 mai au 12 octobre 2028.
