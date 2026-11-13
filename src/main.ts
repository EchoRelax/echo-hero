import { localize, setLanguage } from './i18n'
import { loadSettings } from './systems/Settings'
import { crazyGames } from './platform/CrazyGames'
import { Game } from './game/Game'
import { HeroModel } from './entities/HeroModel'
import { EnemyModel } from './entities/ActorModels'
import { ForestAssets } from './world/ForestAssets'
import { Boss2Model } from './entities/Boss2Model'
import { Boss3Model } from './entities/Boss3Model'
import './style.css'
import './cartoon-ui.css'

const root = document.querySelector<HTMLElement>('#game')!

setLanguage(loadSettings().language)

async function start() {
  root.innerHTML = '<section class="startup-error panel" role="status"><h1>Preparing the hunt</h1><p>Loading your hunter and equipment…</p></section>'
  localize(root)
  try {
    await crazyGames.initialize()
    setLanguage(loadSettings().language)
    crazyGames.loadingStart()
    await Promise.all([HeroModel.preload(), EnemyModel.preload(), ForestAssets.preload(), Boss2Model.preload(), Boss3Model.preload()])
    root.replaceChildren()
    new Game(root)
  } catch (error) {
    crazyGames.loadingStop()
    crazyGames.setGameplay(false)
    console.error(error)
    root.innerHTML = '<section class="startup-error panel"><h1>The hunt could not start</h1><p>Check your connection and graphics acceleration, then reload the page.</p></section>'
    localize(root)
  }
}

void start()
