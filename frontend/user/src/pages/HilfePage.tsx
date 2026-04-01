import { useMemo } from 'preact/hooks';
import { useI18n } from '@/i18n';

export function HilfePage() {
  const { t } = useI18n();
  const steps = useMemo(
    () => [
      {
        number: 1,
        title: t('help.steps.browse.title'),
        intro: t('help.steps.browse.intro'),
        items: [
          [t('help.steps.browse.item1Label'), t('help.steps.browse.item1Text')],
          [t('help.steps.browse.item2Label'), t('help.steps.browse.item2Text')],
          [t('help.steps.browse.item3Label'), t('help.steps.browse.item3Text')],
        ],
      },
      {
        number: 2,
        title: t('help.steps.cart.title'),
        intro: t('help.steps.cart.intro'),
        items: [
          [t('help.steps.cart.item1Label'), t('help.steps.cart.item1Text')],
          [t('help.steps.cart.item2Label'), t('help.steps.cart.item2Text')],
          [t('help.steps.cart.item3Label'), t('help.steps.cart.item3Text')],
        ],
      },
      {
        number: 3,
        title: t('help.steps.submit.title'),
        intro: t('help.steps.submit.intro'),
        items: [
          [t('help.steps.submit.item1Label'), t('help.steps.submit.item1Text')],
          [t('help.steps.submit.item2Label'), t('help.steps.submit.item2Text')],
          [t('help.steps.submit.item3Label'), t('help.steps.submit.item3Text')],
          [t('help.steps.submit.item4Label'), t('help.steps.submit.item4Text')],
          [t('help.steps.submit.item5Label'), t('help.steps.submit.item5Text')],
          [t('help.steps.submit.item6Label'), t('help.steps.submit.item6Text')],
        ],
      },
      {
        number: 4,
        title: t('help.steps.after.title'),
        intro: t('help.steps.after.intro'),
        items: [
          [t('help.steps.after.item1Label'), t('help.steps.after.item1Text')],
          [t('help.steps.after.item2Label'), t('help.steps.after.item2Text')],
          [t('help.steps.after.item3Label'), t('help.steps.after.item3Text')],
          [t('help.steps.after.item4Label'), t('help.steps.after.item4Text')],
        ],
      },
      {
        number: 5,
        title: t('help.steps.status.title'),
        intro: t('help.steps.status.intro'),
        items: [
          [t('help.steps.status.item1Label'), t('help.steps.status.item1Text')],
          [t('help.steps.status.item2Label'), t('help.steps.status.item2Text')],
          [t('help.steps.status.item3Label'), t('help.steps.status.item3Text')],
        ],
      },
      {
        number: 6,
        title: t('help.steps.cancel.title'),
        intro: t('help.steps.cancel.intro'),
        items: [
          [t('help.steps.cancel.item1Label'), t('help.steps.cancel.item1Text')],
          [t('help.steps.cancel.item2Label'), t('help.steps.cancel.item2Text')],
          [t('help.steps.cancel.item3Label'), t('help.steps.cancel.item3Text')],
        ],
      },
    ],
    [t]
  );

  return (
    <main className="flex-1 flex overflow-hidden">
      <section className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white p-8 rounded-lg shadow-sm mb-6">
            <h1 className="text-3xl font-bold text-secondary mb-4">{t('help.title')}</h1>
            <p className="text-text-secondary">{t('help.intro')}</p>
          </div>

          {steps.map((step) => (
            <div key={step.number} className="bg-white p-6 rounded-lg shadow-sm mb-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary text-secondary font-bold rounded-full flex items-center justify-center flex-shrink-0">
                  {step.number}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-secondary mb-3">{step.title}</h2>
                  <p className="text-text-secondary mb-4">{step.intro}</p>
                  <ul className="space-y-2 text-text-secondary list-disc list-inside">
                    {step.items.map(([label, text], index) => (
                      <li key={`${step.number}-${index}`}>
                        <strong>{label}</strong>{text ? ` ${text}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-primary/10 p-6 rounded-lg border border-primary/20">
            <h2 className="text-xl font-semibold text-secondary mb-3">{t('help.contactTitle')}</h2>
            <p className="text-text-secondary">{t('help.contactBody')}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
