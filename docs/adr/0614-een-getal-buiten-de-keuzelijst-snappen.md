# Een getal buiten de keuzelijst snappen

Een opgeslagen getal dat niet in de toegestane keuzelijst staat, wordt naar de dichtstbijzijnde toegestane waarde
gezet (`snapToChoice` in `src/utils/numberChoice.ts`), niet verworpen en niet op het bereik geklemd. Instellingen,
rapportinstellingen en de printvoorvertoning gebruiken dezelfde regel. Zo'n waarde is meestal een met de hand
bewerkte of half omgezette voorkeur: verwerpen zet haar terug op de standaard en verliest wat de gebruiker bedoelde,
en klemmen kan een waarde geven die in de keuzelijst van de UI niet bestaat.
