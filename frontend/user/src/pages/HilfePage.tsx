export function HilfePage() {
  return (
    <main className="flex-1 flex overflow-hidden">
      <section className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white p-8 rounded-lg shadow-sm mb-6">
            <h1 className="text-3xl font-bold text-secondary mb-4">
              Hilfe & Anleitung
            </h1>
            <p className="text-text-secondary">
              Willkommen bei EHALP! Hier finden Sie eine Schritt-für-Schritt-Anleitung zur Nutzung der Plattform.
            </p>
          </div>

          {/* Step 1: Browse Materials */}
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary text-secondary font-bold rounded-full flex items-center justify-center flex-shrink-0">
                1
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-secondary mb-3">
                  Materialien durchsuchen
                </h2>
                <p className="text-text-secondary mb-4">
                  Auf der Seite "Materialien durchsuchen" finden Sie alle verfügbaren Erste-Hilfe-Bildungsmaterialien.
                </p>
                <ul className="space-y-2 text-text-secondary list-disc list-inside">
                  <li>
                    <strong>Kategorien filtern:</strong> Verwenden Sie die Checkboxen in der Seitenleiste, um nach Kategorien wie "Reanimation", "Wundversorgung & Trauma" oder "Zubehör" zu filtern.
                  </li>
                  <li>
                    <strong>Suchen:</strong> Nutzen Sie das Suchfeld oben, um nach bestimmten Materialien zu suchen.
                  </li>
                  <li>
                    <strong>Details anzeigen:</strong> Klicken Sie auf ein Material, um mehr Informationen zu sehen.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 2: Add to Cart */}
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary text-secondary font-bold rounded-full flex items-center justify-center flex-shrink-0">
                2
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-secondary mb-3">
                  Artikel in den Warenkorb legen
                </h2>
                <p className="text-text-secondary mb-4">
                  Fügen Sie die benötigten Materialien zu Ihrem Warenkorb hinzu.
                </p>
                <ul className="space-y-2 text-text-secondary list-disc list-inside">
                  <li>
                    <strong>Menge wählen:</strong> Geben Sie die gewünschte Anzahl ein.
                  </li>
                  <li>
                    <strong>Zum Warenkorb hinzufügen:</strong> Klicken Sie auf den "Zum Warenkorb"-Button.
                  </li>
                  <li>
                    <strong>Warenkorb anzeigen:</strong> Die aktuelle Anzahl der Artikel wird im Header angezeigt.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 3: Submit Request */}
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary text-secondary font-bold rounded-full flex items-center justify-center flex-shrink-0">
                3
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-secondary mb-3">
                  Anfrage absenden
                </h2>
                <p className="text-text-secondary mb-4">
                  Im Warenkorb können Sie Ihre Anfrage erstellen und absenden.
                </p>
                <ul className="space-y-2 text-text-secondary list-disc list-inside">
                  <li>
                    <strong>Mengen anpassen:</strong> Ändern Sie die Mengen direkt im Warenkorb oder entfernen Sie Artikel.
                  </li>
                  <li>
                    <strong>Lieferdatum:</strong> Wählen Sie das gewünschte Lieferdatum aus.
                  </li>
                  <li>
                    <strong>Rückgabedatum:</strong> Geben Sie an, wann Sie die Materialien zurückgeben können.
                  </li>
                  <li>
                    <strong>Schüleranzahl:</strong> Geben Sie die Anzahl der teilnehmenden Schüler an.
                  </li>
                  <li>
                    <strong>Lieferadresse:</strong> Tragen Sie die vollständige Lieferadresse ein.
                  </li>
                  <li>
                    <strong>Anfrage senden:</strong> Klicken Sie auf "Anfrage senden", um die Anfrage abzuschicken.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 4: After Submission */}
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary text-secondary font-bold rounded-full flex items-center justify-center flex-shrink-0">
                4
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-secondary mb-3">
                  Nach der Einreichung
                </h2>
                <p className="text-text-secondary mb-4">
                  Was passiert, nachdem Sie Ihre Anfrage abgeschickt haben?
                </p>
                <ul className="space-y-2 text-text-secondary list-disc list-inside">
                  <li>
                    <strong>Bestätigung:</strong> Sie erhalten eine Bestätigung per E-Mail.
                  </li>
                  <li>
                    <strong>Genehmigungsprozess:</strong> Ihre Anfrage wird von der Organisation geprüft.
                  </li>
                  <li>
                    <strong>Verpackung:</strong> Nach Genehmigung werden die Materialien für den Versand vorbereitet.
                  </li>
                  <li>
                    <strong>Versand:</strong> Die Materialien werden an die angegebene Adresse versendet.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 5: Track Status */}
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary text-secondary font-bold rounded-full flex items-center justify-center flex-shrink-0">
                5
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-secondary mb-3">
                  Anfragenstatus verfolgen
                </h2>
                <p className="text-text-secondary mb-4">
                  Unter "Meine Anfragen" können Sie alle Ihre Anfragen einsehen.
                </p>
                <ul className="space-y-2 text-text-secondary list-disc list-inside">
                  <li>
                    <strong>Statusübersicht:</strong> Sehen Sie den aktuellen Status jeder Anfrage.
                  </li>
                  <li>
                    <strong>Mögliche Status:</strong> Ausstehend, Genehmigt, Abgelehnt, Versendet, Abgeschlossen.
                  </li>
                  <li>
                    <strong>Details:</strong> Klicken Sie auf eine Anfrage, um alle Details anzuzeigen.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 6: Cancel Request */}
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary text-secondary font-bold rounded-full flex items-center justify-center flex-shrink-0">
                6
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-secondary mb-3">
                  Anfrage stornieren
                </h2>
                <p className="text-text-secondary mb-4">
                  Sie können eine Anfrage stornieren, solange sie noch nicht versendet wurde.
                </p>
                <ul className="space-y-2 text-text-secondary list-disc list-inside">
                  <li>
                    <strong>Gehen Sie zu "Meine Anfragen".</strong>
                  </li>
                  <li>
                    <strong>Stornieren-Button:</strong> Bei ausstehenden oder genehmigten Anfragen finden Sie einen Stornieren-Button.
                  </li>
                  <li>
                    <strong>Bestätigung:</strong> Die Stornierung wird umgehend bearbeitet.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Help Contact */}
          <div className="bg-primary/10 p-6 rounded-lg border border-primary/20">
            <h2 className="text-xl font-semibold text-secondary mb-3">
              Weitere Fragen?
            </h2>
            <p className="text-text-secondary">
              Bei technischen Problemen oder weiteren Fragen senden sie ein email an peselis20100@gmail.com.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
