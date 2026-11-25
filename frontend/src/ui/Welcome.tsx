import { useEscape } from './game/common'
import { useCity } from '../store/cityStore'
import { KindArt } from './art'
import { Logo } from './TopBar'

const STEPS = [
  {
    art: <KindArt kind="clinic" size={56} />,
    title: 'Город живёт сам',
    text: 'Каждые несколько минут проходит игровой день. Если чего-то не хватает (врачей, тока, воды), начинается кризис и люди уезжают.',
  },
  {
    art: <KindArt kind="cafe" size={56} />,
    title: 'Выполняй задания',
    text: 'Почини проводку, доставь посылку, нарисуй что-нибудь. За это ты получаешь Искры, а город — новых жителей.',
  },
  {
    art: <KindArt kind="construction" size={56} />,
    title: 'Стройте вместе',
    text: 'Больницы, парки и электростанции строятся только на деньги жителей. Скидывайтесь во вкладке «Проекты».',
  },
  {
    art: <KindArt kind="apartment" size={56} />,
    title: 'Строй сам',
    text: 'Вкладка «Стройка»: купи участок и построй дом, малоэтажку, магазин или офис. Новые дома приводят жителей, а тебе каждый час идёт аренда.',
  },
  {
    art: <KindArt kind="business" size={56} />,
    title: 'Открой своё дело',
    text: 'Кофейня, магазин или ресторан со своим названием и цветом. Чем лучше место и цены, тем больше гостей и выручки.',
  },
]

export function Welcome() {
  const open = useCity((s) => s.helpOpen)
  const setHelpOpen = useCity((s) => s.setHelpOpen)
  useEscape(() => setHelpOpen(false), open)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#17202b]/40 p-0 backdrop-blur-[2px] desk:items-center desk:p-6" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="anim-pop flex max-h-[92vh] w-full max-w-[620px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl desk:rounded-[28px]">
        <div className="bg-gradient-to-b from-[#fbe3c4] to-white px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <Logo size={44} />
            <div>
              <div className="text-xs font-semibold text-[#a0582c]">Добро пожаловать в</div>
              <h2 id="welcome-title" className="font-display text-2xl font-bold tracking-[0.06em]">AFTERLIGHT</h2>
            </div>
          </div>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[#3a4554]">
            Ты житель маленького города на острове. Ему не хватает врачей и электричества. Вместе с другими жителями ты решаешь, каким он станет. Город двигаешь одним пальцем, крутишь и приближаешь двумя. Ещё проще: кнопки «+», «−» и стрелки справа на экране. На здания нажимай.
          </p>
        </div>
        <ol className="scroll-thin grid min-h-0 gap-2 overflow-y-auto px-4 pb-2 desk:grid-cols-2">
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
          <span className="hidden text-xs text-[var(--color-faint)] desk:block">Открыть это окно снова: кнопка «Помощь»</span>
          <button className="btn-primary w-full desk:w-auto" onClick={() => setHelpOpen(false)} autoFocus>
            Начать
          </button>
        </div>
      </div>
    </div>
  )
}
