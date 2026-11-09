# Vertalingen van het standaardtaaktype

De nieuwe naam en toelichting zijn aanwezig in alle 28 talen. Nederlands en Engels zijn de bronnen. De andere 26 talen zijn vertaald en apart nagelezen met Haiku 5.5: 53 afgeronde opdrachten, waarvan 26 vertalingen, 26 naleesbeurten en één herstel.

De Oekraïense toelichting kreeg na het nalezen een natuurlijker woord voor het overnemen van een instelling. Alle verplichte opdrachten waren afgerond vóór het toepassen. Elk pakket is daarna opnieuw gecontroleerd en via de bestaande vertaalstraat toegepast; nergens bleef een rood pakket over.

| Taal | Teksten | Bevindingen | Hersteld | Waarschuwingen | Exitcode pakketcontrole |
|---|---:|---:|---:|---:|---:|
| fr | 2 | 0 | 0 | 0 | 0 |
| de | 2 | 0 | 0 | 0 | 0 |
| es | 2 | 0 | 0 | 1 | 0 |
| zh | 2 | 0 | 0 | 0 | 0 |
| it | 2 | 0 | 0 | 1 | 0 |
| pt | 2 | 0 | 0 | 1 | 0 |
| pl | 2 | 0 | 0 | 0 | 0 |
| tr | 2 | 0 | 0 | 0 | 0 |
| ar | 2 | 0 | 0 | 0 | 0 |
| ja | 2 | 0 | 0 | 0 | 0 |
| ko | 2 | 0 | 0 | 0 | 0 |
| fa | 2 | 0 | 0 | 0 | 0 |
| ru | 2 | 0 | 0 | 1 | 0 |
| uk | 2 | 1 | 1 | 2 | 0 |
| cs | 2 | 0 | 0 | 0 | 0 |
| sk | 2 | 0 | 0 | 1 | 0 |
| sr | 2 | 0 | 0 | 1 | 0 |
| hr | 2 | 0 | 0 | 1 | 0 |
| bg | 2 | 0 | 0 | 1 | 0 |
| hu | 2 | 0 | 0 | 3 | 0 |
| ro | 2 | 0 | 0 | 0 | 0 |
| sv | 2 | 0 | 0 | 0 | 0 |
| nb | 2 | 0 | 0 | 0 | 0 |
| da | 2 | 0 | 0 | 0 | 0 |
| fi | 2 | 0 | 0 | 0 | 0 |
| lo | 2 | 0 | 0 | 0 | 0 |

De niet-blokkerende waarschuwingen betreffen tekstlengte en algemene termen die niet letterlijk in de toelichting staan. De toelichting gebruikt daar de bestaande vertaling van de naam Projectstandaard. Alle pakketten zijn apart nagelezen; de verplichte controles op de inhoud slaagden.

`verify:i18n` eindigde met exitcode 0. De controle van de twee nieuwe sleutels met de bestaande vertaalstatusfuncties eindigde ook met exitcode 0: beide zijn actueel in alle talen, inclusief de bronhashes voor Engels en de 26 doeltalen.

De algemene releasepoort `verify:translations` eindigde met exitcode 1. Die controleert de gehele interface en meldt 3303 achterlopende vertalingen. Een vergelijking met alle locale- en bronhashbestanden uit main `6a13bd158c94a3cdb01ca7e2b3e666a6aba5310e` levert exact dezelfde 3303 meldingen op, per taal en sleutel. Deze wijziging voegt daar geen melding aan toe. Voorbeelden van de bestaande meldingen zijn `common:notifications.exportP6XmlLossItem.hammocks` zonder Engelse bronhash en `common:settings.ribbonWheelSwitchesTabsHint` met een verouderde bronhash.
