import { useCity } from '../store/cityStore'
import { DistrictArt, KindArt } from './art'
import { Logo } from './TopBar'

const STEPS = [
  {
    art: <DistrictArt id="downtown" size={56} />,
    title: 'Выбери район',
    text: 'В городе три района: Жилой квартал, Центр и Промзона. Нажми на кнопку района, и камера перелетит туда.',
  },
  {
    art: <KindArt kind="cafe" size={56} />,
    title: 'Нажми на здание',
    text: 'Откроется карточка: что это за место, сколько там людей, когда построено. Стрелками можно листать здания.',
  },
  {
    art: <KindArt kind="park" size={56} />,
    title: 'Крути город',
    text: 'На телефоне: одним пальцем вращай, двумя приближай. На компьютере: мышь и колёсико.',
  },
  {
    art: <KindArt kind="unknown" size={56} />,
    title: 'Ищи тайны',
    text: 'Здания со знаком «?» закрыты. Что внутри, жители узнают позже, через городские события.',
  },
]

export function Welcome() {
  const open = useCity((s) => s.helpOpen)
  const setHelpOpen = useCity((s) => s.setHelpOpen)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#17202b]/40 p-0 backdrop-blur-[2px] md:items-center md:p-6" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="anim-pop flex max-h-[92vh] w-full max-w-[620px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:rounded-[28px]">
        <div className="bg-gradient-to-b from-[#fbe3c4] to-white px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <Logo size={44} />
            <div>
              <div className="text-xs font-semibold text-[#a0582c]">Добро пожаловать в</div>
              <h2 id="welcome-title" className="font-display text-2xl font-bold tracking-[0.06em]">AFTERLIGHT</h2>
            </div>
          </div>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[#3a4554]">
            Это живой город. Сейчас в нём три района и около семидесяти зданий. Скоро здесь появятся жители, свои дома и события, которые меняют город.
          </p>
        </div>
        <ol className="scroll-thin grid min-h-0 gap-2 overflow-y-auto px-4 pb-2 md:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.title} className="flex gap-3 rounded-2xl bg-[var(--color-soft)] p-3">
              {s.art}
              <div>
                <div className="font-display text-[15px] font-semibold">{s.title}</div>
                <p className="mt-0.5 text-[13px] leading-snug text-[var(--color-muted)]">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex items-center justify-between gap-3 px-6 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
          <span className="hidden text-xs text-[var(--color-faint)] md:block">Открыть это окно снова: кнопка «Помощь»</span>
          <button className="btn-primary w-full md:w-auto" onClick={() => setHelpOpen(false)} autoFocus>
            Начать прогулку
          </button>
        </div>
      </div>
    </div>
  )
}
