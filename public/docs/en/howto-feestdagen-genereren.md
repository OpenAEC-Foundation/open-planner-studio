# Generating holidays and the construction holiday

Goal: have the holidays of a country, and possibly the construction holiday, filled into a calendar, and add a day or period off of your own where needed.

## When you need this

Without holidays the app simply plans work on Christmas or King's Day. A new project already gets the Dutch holidays, as long as *Construction mode* is on. You generate again if you need another country or region, if you want to include the construction holiday, or if your project falls outside the years for which holidays were created. Those years matter: to the app a day outside them is simply a work day. How the app takes a holiday into account when counting, you can read in [Calendars and working days](docs://uitleg-kalenders).

The **construction holiday** (*bouwvak*) is the collective holiday in the Dutch building industry, three weeks in summer. In the app it is off by default.

## Steps

### Generating holidays

1. Choose *Planning › Calendar › Calendar* and pick on the left the calendar the holidays must go into.
2. Click *Generate holidays…*. Under the button a block with the choices opens.
3. Choose the *Country*: Netherlands, Germany, Belgium, France, United Kingdom, Austria, Switzerland, or *No holidays*. For a number of countries a *Region* list appears as well, for example a federal state in Germany. *National* leaves only the holidays that apply everywhere.
4. For the Netherlands, choose the *Construction holiday*: *None* (default), *North*, *Central* or *South*. The construction holiday appears as one period in the list, for example *Bouwvak (Noord)*, three weeks from Monday to Friday. You only see this choice if *Construction mode* is on.
5. Under the choices is a summary, such as *24 holidays, 2026–2028*. Click it to see the dates.
6. Click *Generate*. The *Holidays* list is now filled.
7. Click *Apply*. The app recalculates the schedule right away.

For the Netherlands the app puts Nieuwjaar, Goede Vrijdag, Pasen (two days), Koningsdag, Hemelvaart, Pinksteren (two days) and Kerst (25 and 26 December) in the list each year (New Year's Day, Good Friday, Easter, King's Day, Ascension Day, Whitsun and Christmas). If King's Day falls on a Sunday, it is on 26 April. Bevrijdingsdag (Liberation Day) is only in the list in lustrum years, such as 2025 and 2030.

The years follow the project period: from the year before the start date to the year after the end date. If the project has no end date, up to three years after the year of the start. You adjust start and end under *Settings › Project › Project info*.

### Regenerating after a new project period

If your project shifts, or gets a later end date, the holidays no longer cover the new years. The app says so in the *Calendars* window, for example *Holidays cover 2025–2028; project runs to 2030. Regenerate?* Then click *Regenerate*. The app uses the same choices as last time (country, region, construction holiday) for the years of the project. Then click *Apply*. You only see this message for a calendar whose holidays were generated earlier.

### Adding a day or period off of your own

1. In the *Calendars* window, click *Add holiday*. At the bottom of the list a new row appears, with today's date under *From*.
2. Fill in the *Description*, for example *Company outing*.
3. Adjust *From*. Leave *Until* empty for one day, or fill in the last day off for a period, for example for a winter break.
4. Click *Apply*.

With the bin behind a row you remove a holiday.

### Removing all holidays

Choose *No holidays* under *Country* and click *Generate*. The list is then empty.

## Pitfalls and what the app does then

**Generating replaces the whole list.** The days you added yourself disappear too. Add them again afterwards.

**Goede Vrijdag is included.** If your company works on Good Friday, or on Liberation Day in a lustrum year, remove that row with the bin.

**The construction holiday dates are advisory dates.** The app knows them for 2025 up to and including 2028; for other years it makes a rough estimate. With a construction holiday chosen it therefore says *Advisory dates — verify with Bouwend Nederland*. Adjust the period in the list if needed.

**An invalid row.** A row without a valid *From*, an *Until* that lies before *From* or an unreadable date gets a red message, for example *The end date is before the start date.* *Apply* is disabled until you fix it.

**With a new project.** The *New project* window has the same choices under *Holiday set*. With *Custom…* you start without holidays; after creating, the *Calendars* window opens so that you can fill them in yourself.

## See also

- [Calendars and working days](docs://uitleg-kalenders): how the app takes holidays and the construction holiday into account when counting work days.
- [Creating and assigning a calendar](docs://howto-kalender-maken-en-toewijzen): making a calendar of your own to put holidays in.
