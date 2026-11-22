# Dreame Mowers

Steuere deine **Dreame**- und **MOVA**-Mähroboter mit Gladys Assistant:
Status, Akku, Start, Pause, Rückkehr zur Station, Szenen und ein
Dashboard-Widget.

Die Mäher haben keine lokale API: Wie die Dreame-App läuft die Integration
über die **Dreame-Cloud** (Internetverbindung erforderlich).

## Unterstützte Mäher

Jeder Mäher eines Dreamehome- oder MOVAhome-Kontos, dessen Modell mit
`dreame.mower.` oder `mova.mower.` beginnt: Dreame A1, A1 Pro, A2, A3 AWD,
MOVA 600, 1000, LiDAX, Viax… Ein Modell, das hier fehlt, erscheint trotzdem,
unter seinem technischen Namen.

## Konfiguration

1. Öffne den Reiter **Konfiguration** der Integration.
2. **App**: Dreamehome oder MOVAhome, die App, in der dein Konto erstellt wurde.
3. **E-Mail** und **Passwort** dieses Kontos.
   Ein mit „Mit Google / Apple anmelden" erstelltes Konto hat kein Passwort:
   lege zuerst in der App eines fest (Profil → Konto und Sicherheit).
4. **Region**: die bei der Erstellung des Kontos gewählte Region (Europa für
   die meisten Nutzer in Europa).
5. **Sprache der Zustände**: Sprache der Status- und Fehlertexte.
6. **Aktualisierungsintervall**: wie oft die Cloud gelesen wird, mindestens
   jede Minute.
7. Klicke auf **Verbindung testen**: die gefundenen Mäher werden unter der
   Schaltfläche angezeigt.
8. Öffne den Reiter **Erkennung** und füge deine Mäher hinzu.

## Was jeder Mäher anzeigt

| Funktion       | Typ          | Verwendung                               |
| -------------- | ------------ | ---------------------------------------- |
| Mowing         | Schalter     | Ein = mähen, Aus = Pause                 |
| Return to base | Schalter     | Ein = zurück zur Station                 |
| Status         | Text         | Mäht, Pausiert, Lädt, Fährt zur Station… |
| Battery        | Akku (%)     | Ladestand                                |
| Charging       | Akku (binär) | 1, solange der Akku lädt                 |
| Error          | Text         | „Kein Fehler", „Mäher festgefahren (2)"… |

Ein Abzeichen an jedem Gerät zeigt, ob der Mäher über die Cloud antwortet
(**cloud**) oder nicht (**nicht erreichbar**: kein WLAN / 4G, ausgeschaltet…).

## Szenen

In der Kategorie **Integrationen** des Szeneneditors:

- **Status des Mähers ändert sich** (Auslöser) — wenn der Mäher startet,
  pausiert, zurückkehrt, parkt oder mit Fehler stoppt. Optional Mäher und
  neuen Status wählen. Variablen: `{{triggerEvent.data.status}}`,
  `{{triggerEvent.data.previous_status}}`, `{{triggerEvent.data.battery}}`.
- **Mäher meldet einen Fehler** (Auslöser) — ein neuer Fehler (festgefahren,
  gekippt, Messer blockiert…). Variablen: `{{triggerEvent.data.error_code}}`,
  `{{triggerEvent.data.error_text}}`.
- **Mäher steuern** (Aktion) — starten, pausieren, stoppen oder zur Station
  schicken. Die Ausgabe **Befehl gesendet** zeigt, ob die Cloud den Befehl
  angenommen hat.

Beispiele: eine Benachrichtigung, wenn der Mäher festsitzt; ihn bei Regen zur
Station schicken; ihn jeden Morgen starten, wenn niemand im Garten ist.

## Dashboard-Widget

Füge die Box **Mähroboter** zu einem Dashboard hinzu: Akku, Status, Fehler,
Verbindung und drei Tasten (Mähen, Pause, Zur Station). In den Einstellungen
den anzuzeigenden Mäher wählen (leer: der erste Mäher des Kontos).

## Fehlerbehebung

- **Anmeldung abgelehnt**: E-Mail, Passwort, App (Dreamehome oder MOVAhome)
  und Region prüfen. Einmal in der App mit denselben Zugangsdaten anmelden.
- **Kein Mäher gefunden**: der Mäher muss in der App desselben Kontos
  erscheinen (ein geteilter Mäher erscheint auch).
- **Nicht erreichbar**: der Mäher ist nicht mit der Cloud verbunden. WLAN
  oder 4G prüfen und ob er eingeschaltet ist.
- **Der Zustand ändert sich verzögert**: die Cloud wird im gewählten Intervall
  gelesen; nach einem Befehl wird der Mäher 5 Sekunden später neu gelesen.

## Datenschutz

Das Passwort wird in einem geheimen Gladys-Feld gespeichert und nur gehasht
an die Dreame-Cloud gesendet. Sonst verlässt nichts dein Gladys.
