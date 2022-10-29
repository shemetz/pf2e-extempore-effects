const MODULE_ID = 'pf2e-extempore-effects'
const MODULE_NAME = 'pf2E Extempore Effects'

Hooks.on('init', () => {
  libWrapper.register(
    MODULE_ID,
    'CONFIG.PF2E.Actor.documentClasses.character.prototype.temporaryEffects',
    ActorPF2E_temporaryEffects_Wrapper,
    'WRAPPER',
  )
  libWrapper.register(
    MODULE_ID,
    'CONFIG.Token.objectClass.prototype.showFloatyText',
    TokenPF2E_showFloatyText_Wrapper,
    'WRAPPER',
  )
})

/**
 * add GM-only toggle on the effect edit sheet, which makes the effect hidden from players
 */
Hooks.on('renderEffectSheetPF2e', (sheet, $html) => {
  if (!game.user.isGM) {
    return
  }
  const effect = sheet.object
  const hiddenFromPlayer = effect.getFlag(MODULE_ID, 'hiddenFromPlayer')
  $html.find('div.inventory-details').append(`
  <div class="form-group">
      <label for="data.tokenIcon.show">${game.i18n.localize(MODULE_ID + '.hiddenFromPlayerText')}</label>
      <div class="form-fields">
          <input type="checkbox" id="hiddenFromPlayer" ${hiddenFromPlayer ? 'checked="checked"' : ''}>
      </div>
  </div>
`)
  const $toggle = $html.find('#hiddenFromPlayer')
  $toggle.on('click', async (event) => {
    await effect.setFlag(MODULE_ID, 'hiddenFromPlayer', event.currentTarget.checked || null)
  })
})

/**
 * visually mark effects in effects panel
 */
Hooks.on('renderEffectsPanel', (panel, $html) => {
  const divElems = $html.find('.effect-item > div.icon')
  let foundHiddenEffect = false
  divElems.each((i, dElem) => {
    const itemId = dElem.dataset.itemId
    const panel = game.pf2e.effectPanel
    const actor = panel.actor
    const effect = actor.items.get(itemId)
    const hidden = effect.getFlag(MODULE_ID, 'hiddenFromPlayer')
    if (hidden) {
      const effectElement = dElem.parentElement
      if (game.user.isGM) {
        $(effectElement).addClass('pf2e-extempore-effects-hidden-effect-on-effects-panel')
      } else {
        effectElement.remove()
        foundHiddenEffect = true
      }
    }
  })
  // delete horizontal line if there's no longer an effect after it
  const hrElement = $html.find('hr')[0]
  if (hrElement && !hrElement.nextElementSibling) {
    $html.find('hr').remove()
  }
})

/**
 * prevent seeing hidden effects in character sheet
 */
Hooks.on('renderCharacterSheetPF2e', (sheet, $html) => {
  const actor = sheet.object
  const $effectsTab = $html.find('section.sheet-body .sheet-content > .tab[data-tab=effects]')
  const $effectListLines = $effectsTab.find('ol > li.item.effects')
  $effectListLines.each((i, effectElement) => {
    const id = effectElement.dataset.itemId
    const effect = actor.items.get(id)
    const hidden = effect.getFlag(MODULE_ID, 'hiddenFromPlayer')
    if (hidden) {
      if (game.user.isGM) {
        $(effectElement).addClass('pf2e-extempore-effects-hidden-effect-on-sheet')
      } else {
        effectElement.remove()
      }
    }
  })
})

/**
 * prevent seeing hidden effects in the Token Action HUD module
 */
Hooks.on('renderTokenActionHUD', (hud, $html) => {
  const buttonElems = $html.find('#tah-category-effects  .tah-action > button')
  buttonElems.each((i, bElem) => {
    // e.g. 'item|z5BQ6gk5CcTkJkLN|KET1aP6vfUUes0oC' -> 'KET1aP6vfUUes0oC'
    const [_, actorId, itemId] = bElem.value.split('|')
    const effect = canvas.tokens.get(actorId).actor.items.get(itemId)
    const hidden = effect.getFlag(MODULE_ID, 'hiddenFromPlayer')
    if (hidden) {
      const effectElement = bElem.parentElement
      if (game.user.isGM) {
        $(effectElement).addClass('pf2e-extempore-effects-hidden-effect-on-token-hud')
      } else {
        effectElement.remove()
      }
    }
  })
})

/**
 * prevent seeing hidden effects as status icons on tokens, on the canvas
 */
function ActorPF2E_temporaryEffects_Wrapper (wrapped, ...args) {
  if (game.user.isGM) return wrapped(args)

  const effectsHidden = this.itemTypes.effect.filter(
    (effect) => effect.system.tokenIcon?.show && effect.getFlag(MODULE_ID, 'hiddenFromPlayer'))
  effectsHidden.forEach(effect => effect.system.tokenIcon.show = false)
  const returned = wrapped(args)
  effectsHidden.forEach(effect => effect.system.tokenIcon.show = true)

  return returned
}

/**
 * prevent floaty text from appearing for hidden effects
 */
function TokenPF2E_showFloatyText_Wrapper (wrapped, params) {
  const effectData = params.create || params.delete
  if (!effectData?.flags) return wrapped(params)
  const hidden = effectData.flags[MODULE_ID]?.['hiddenFromPlayer']
  if (!hidden || game.user.isGM || this.document.hidden) return wrapped(params)

  this.document.hidden = true
  const returned = wrapped(params)
  this.document.hidden = false
  return returned
}
