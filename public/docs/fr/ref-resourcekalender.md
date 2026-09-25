# Calendrier de la ressource

La fenêtre **Calendrier de la ressource** modifie le calendrier propre d'une seule ressource — par exemple une équipe qui travaille quatre jours par semaine. Le formulaire est identique à la [boîte de dialogue de calendrier](docs://ref-kalenderdialoog) ; cet article ne décrit que les différences.

## Ouverture

- Ouvrez le panneau des ressources : **Ressources** → groupe de ruban **Gérer** → **Ressources** (panneau complet) ou **Dock ressources** (ancré à côté du Gantt).
- Dans la colonne **Calendrier** d'une ressource, choisissez un calendrier et cliquez sur l'icône de crayon (**Modifier…**) à côté pour le modifier ; créez un nouveau calendrier via la même liste déroulante.

## Différences par rapport à la boîte de dialogue de calendrier

- **Un seul calendrier à la fois** — pas de liste de bibliothèque à gauche, pas d'étoile de calendrier par défaut du projet ; juste le formulaire.
- **Appliquer** enregistre le calendrier ; **Annuler**, **Échap**, la croix de fermeture ou un clic en dehors de la fenêtre abandonne les modifications. Un nouveau calendrier créé avec **+ Calendrier de la ressource** dans la liste déroulante n'existe qu'après **Appliquer** et est alors aussitôt lié à la ressource (ensemble, une seule étape d'annulation) ; après **Annuler**, rien ne subsiste. Il part de la même valeur par défaut que **+** dans la boîte de dialogue des calendriers.
- **Pas de recalcul automatique** — **Appliquer** ne recalcule pas le planning. Dans son rôle de calendrier de ressource, un calendrier ne change pas les dates CPM ; il compte pour la charge (histogramme) et le nivellement, que vous relancez vous-même respectivement avec F5 ou **Niveler…**. La liste déroulante propose toutefois tous les calendriers du projet : si vous modifiez ici un calendrier qui est aussi le calendrier du projet ou celui d'une tâche, le planning change bel et bien. Il est alors marqué comme obsolète et F5 le recalcule.

## Champs

Voir la [boîte de dialogue de calendrier](docs://ref-kalenderdialoog) pour la référence complète des champs : **Nom**, **Jours ouvrés** (avec les préréglages Lun–ven et Continu (24/7)), **Début (heure)** / **Fin (heure)** / **Heures par jour**, la section **Horaires de travail** (avec la planification horaire activée), **Générer les jours fériés…** et la liste **Jours fériés**.

## Poursuivre la lecture

- [Calendriers & planification horaire](docs://gids-kalenders-uren) — quand un calendrier de ressource est le bon choix.
- [Ressources, histogramme & nivellement](docs://gids-resources-histogram) — comment le calendrier alimente la charge et le nivellement.
