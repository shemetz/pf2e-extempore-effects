const MODULE_ID = 'pf2e-extempore-effects'
const MODULE_NAME = 'pf2E Extempore Effects'
const LATEST_MIGRATION_VERSION = 2

Hooks.on('init', () => {
  libWrapper.register(
    MODULE_ID,
    'ChatLog.prototype._getEntryContextOptions',
    _getEntryContextOptions_Wrapper,
    'WRAPPER',
  )
  game.settings.register(MODULE_ID, 'randomize-image-if-default', {
    name: game.i18n.localize(MODULE_ID + '.settings.randomize-image-if-default.name'),
    hint: game.i18n.localize(MODULE_ID + '.settings.randomize-image-if-default.hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  })
  game.settings.register(MODULE_ID, 'hidden-by-default', {
    name: game.i18n.localize(MODULE_ID + '.settings.hidden-by-default.name'),
    hint: game.i18n.localize(MODULE_ID + '.settings.hidden-by-default.hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  })
  const { CONTROL, SHIFT } = KeyboardManager.MODIFIER_KEYS
  game.keybindings.register(MODULE_ID, 'quick-add-empty-effect', {
    name: game.i18n.localize(MODULE_ID + '.settings.quick-add-empty-effect.name'),
    hint: game.i18n.localize(MODULE_ID + '.settings.quick-add-empty-effect.hint'),
    editable: [{ key: 'KeyE', modifiers: [CONTROL, SHIFT] }],
    onDown: quickAddEmptyEffect,
  })
  game.settings.register(MODULE_ID, 'migration-version', {
    name: 'migration-version',
    hint: 'migration-version',
    scope: 'world',
    config: false,
    type: Number,
    default: -1,
  })
})

Hooks.on('ready', async () => {
  const migrationVersion = game.settings.get(MODULE_ID, 'migration-version')
  if (migrationVersion >= LATEST_MIGRATION_VERSION)
    return
  if (migrationVersion < 2) {
    console.log(`${MODULE_NAME} | migrating hidden effects...`)
    await migrateAllHiddenEffects()
    game.settings.set(MODULE_ID, 'migration-version', 2)
    console.log(`${MODULE_NAME} | migration version set to 2`)
  }
})

const migrateAllHiddenEffects = async () => {
  let effectsMigrated = 0
  // NOTE:  only migrating actors outside scenes!  unlinked actors are not under the players' control anyways

  const migrate = async effect => {
    const flagValue = effect.getFlag(MODULE_ID, 'hiddenFromPlayer')
    if (flagValue === true) {
      await effect.update({ 'system.unidentified': true })
      await effect.setFlag(MODULE_ID, 'hiddenFromPlayer', false)
      effectsMigrated += 1
    }
  }

  await game.items.forEach(async effect => {
    await migrate(effect)
  })

  await game.actors.forEach(async actor => {
    const effects = actor.items.filter(i => i.type === 'effect')
    for (const effect of effects) {
      await migrate(effect)
    }
  })

  if (effectsMigrated) {
    console.log(`${MODULE_NAME} | migrated ${effectsMigrated} effects to new "unidentified"`)
  }
}

/**
 * show effect sheets on shift-click
 */
Hooks.on('renderEffectsPanel', (panel, $html) => {
  const instructions = `<p>${game.i18n.localize(MODULE_ID + '.openSheetInstruction')}</p>`
  $html.find('.instructions').append(instructions)
  const $icons = $html.find('div[data-item-id]')
  // removing default PF2e system behavior on left click!
  $icons.off('click')
  // adding new behavior, which first checks if shift is pressed
  $icons.on('click', async (event) => {
    const panel = game.pf2e.effectPanel
    const shiftPressed = event.shiftKey
    if (!shiftPressed) return normalIconLeftClickBehavior(event, panel)
    const id = event.currentTarget.dataset.itemId
    const effect = panel.actor?.items.get(id)
    // open and display the sheet
    effect?.sheet.render(true)
  })
})

const normalIconLeftClickBehavior = async (event, panel) => {
  const $target = $(event.currentTarget)
  if ($target.attr('data-locked')) return

  const effect = panel.actor?.items.get($target.attr('data-item-id') ?? '')
  if (effect && isOfClass(effect, 'AbstractEffectPF2e')) await effect.increase()
}

const quickAddEmptyEffect = async () => {
  const tokens = canvas.tokens.controlled
  if (tokens.length !== 1) {
    ui.notifications.error(game.i18n.localize(MODULE_ID + '.errorMultipleTokensCustomEffect'))
  } else {
    const effect = createEmptyEffect()
    const token = tokens[0]
    const effectItems = await token.actor.createEmbeddedDocuments('Item', [effect])
    effectItems[0].sheet.render(true)
  }
}

const _getEntryContextOptions_Wrapper = (wrapped) => {
  const buttons = wrapped.bind(this)()

  // Add a button
  buttons.unshift(
    {
      name: game.i18n.localize(MODULE_ID + '.contextMenuExtemporeEffect'),
      icon: '<i class="fas fa-star"></i>',
      condition: li => {
        const message = game.messages.get(li.data('messageId'))
        if (message?.item?.type === 'effect' || message.getFlag('pf2e', 'origin')?.type === 'effect') {
          return false
        }
        return message?.item || message.getFlag('pf2e', 'origin')?.uuid
      },
      callback: async li => {
        const message = game.messages.get(li.data('messageId'))
        const item = message.item ||
          (message.getFlag('pf2e', 'origin') ? await fromUuid(message.getFlag('pf2e', 'origin').uuid) : null)
        if (item === null) {
          return ui.notifications.error(game.i18n.localize(MODULE_ID + '.errorItemNotFound'))
        }
        const shiftPressed = game.keyboard.isModifierActive(KeyboardManager.MODIFIER_KEYS.SHIFT)
        const effect = createEffect(item)
        const tokens = canvas.tokens.controlled
        if (tokens.length === 0) {
          ui.notifications.error(game.i18n.localize(MODULE_ID + '.errorNoTokensSelected'))
        } else for (const token of tokens) {
          const effectItems = await token.actor.createEmbeddedDocuments('Item', [effect])
          if (shiftPressed) {
            effectItems[0].sheet.render(true)
          }
        }
      },
    },
    // Special case for "Effect" item messages;  though it's very unlikely they'll actually be put in chat
    // (this option and the previous option will never both be available)
    {
      name: game.i18n.localize(MODULE_ID + '.contextMenuApplyEffect'),
      icon: '<i class="fas fa-star"></i>',
      condition: li => {
        const message = game.messages.get(li.data('messageId'))
        if (message?.item?.type === 'effect') return true
        if (message.getFlag('pf2e', 'origin')?.type === 'effect') {
          const item = fromUuidNonAsync(message.getFlag('pf2e', 'origin').uuid)
          return !!item
        }
        return false
      },
      callback: async li => {
        const message = game.messages.get(li.data('messageId'))
        const item = message.item ||
          (message.getFlag('pf2e', 'origin') ? await fromUuid(message.getFlag('pf2e', 'origin').uuid) : null)
        if (item === null) {
          return ui.notifications.error(game.i18n.localize(MODULE_ID + '.errorItemNotFound'))
        }
        const tokens = canvas.tokens.controlled
        if (tokens.length === 0) {
          ui.notifications.error(game.i18n.localize(MODULE_ID + '.errorNoTokensSelected'))
        } else for (const token of tokens) {
          await token.actor.createEmbeddedDocuments('Item', [item.toObject()])
        }
      },
    },
  )
  return buttons
}

function fromUuidNonAsync (uuid) {
  let parts = uuid.split('.')
  let doc

  // Compendium Documents
  if (parts[0] === 'Compendium') {
    return null
  }

  // World Documents
  else {
    const [docName, docId] = parts.slice(0, 2)
    parts = parts.slice(2)
    const collection = CONFIG[docName].collection.instance
    doc = collection.get(docId)
  }

  // Embedded Documents
  while (doc && (parts.length > 1)) {
    const [embeddedName, embeddedId] = parts.slice(0, 2)
    doc = doc.getEmbeddedDocument(embeddedName, embeddedId)
    parts = parts.slice(2)
  }
  return doc || null
}

function getFrequency (frequency) {
  let durationValue, durationUnit, durationSustained = false
  switch (frequency.per) {
    case 'PT1M':
      durationUnit = 'minutes'
      durationValue = 1
      break
    case 'PT10M':
      durationUnit = 'minutes'
      durationValue = 10
      break
    case 'PT1H':
      durationUnit = 'hours'
      durationValue = 1
      break
    case 'PT24H':
      durationUnit = 'hours'
      durationValue = 24
      break
    case 'day':
      durationUnit = 'days'
      durationValue = 1
      break
    case 'PT1W':
      durationUnit = 'days'
      durationValue = 7
      break
  }
  return { durationSustained, durationUnit, durationValue }
}

const getDuration = (durationText, descriptionText) => {
  const itemDuration = durationText || ''
  let durationValue, durationUnit, durationSustained
  if (itemDuration.toLowerCase() === 'sustained') {
    // "Sustained"
    durationValue = 10
    durationUnit = 'minutes'
    durationSustained = true
  } else if (itemDuration.toLowerCase().includes('sustained')) {
    // "Sustained up to 1 minute"
    durationValue = parseInt(itemDuration.split(' ')[3])
    durationUnit = itemDuration.split(' ')[4]
    if (!durationUnit.endsWith('s')) durationUnit += 's'  // e.g. "minutes"
    durationSustained = true
  } else if (itemDuration.toLowerCase() === 'unlimited') {
    // "Unlimited"
    durationValue = 1
    durationUnit = 'unlimited'
    durationSustained = false
  } else if (itemDuration.toLowerCase() === 'varies') {
    // "Varies"
    durationValue = 2
    durationUnit = 'unlimited'
    durationSustained = false
  } else if (itemDuration.toLowerCase() === 'until encounter ends') {
    durationValue = -1
    durationUnit = 'encounter'
    durationSustained = false
  } else if (itemDuration.includes(' or more')) {
    // "1 or more rounds"
    durationValue = 3
    durationUnit = 'unlimited'
    durationSustained = false
  } else if (itemDuration.includes(' ')) {
    // "10 minutes"
    durationValue = parseInt(itemDuration.split(' ')[0])
    durationUnit = itemDuration.split(' ')[1]
    if (!durationUnit.endsWith('s')) durationUnit += 's'  // e.g. "minutes"
    durationSustained = false
  } else if (itemDuration === '') {
    if (descriptionText.includes('<strong>Maximum Duration</strong>')) {
      // an affliction with maximum duration will have that duration set (recursive call!)
      const maxDurationText = descriptionText.match(/<strong>Maximum Duration<\/strong>(.*?)</)[1].trim()
      return getDuration(maxDurationText, descriptionText)
    }
    if (descriptionText.includes('for 1 round') && !descriptionText.includes(' rounds')) {
      durationValue = 1
      durationUnit = 'round'
    } else {
      durationValue = 1
      durationUnit = 'unlimited'
    }
    durationSustained = false
  } else {
    console.warn(`Unexpected duration format - ${itemDuration}`)
    durationValue = 1
    durationUnit = 'unlimited'
    durationSustained = false
  }
  return {
    durationValue,
    durationUnit,
    durationSustained,
  }
}

const isImageBoring = (image) => {
  return !image || image.startsWith('systems/pf2e/icons/actions')
    || image.startsWith('systems/pf2e/icons/default-icons')
    || image === 'systems/pf2e/icons/features/feats/feats.webp'
}

const randomImage = (item) => {
  const hashNum = hashString(item.id)
  const images = RANDOM_EFFECT_IMAGES
  const randomIndex = Math.abs(hashNum) % images.length
  return images[randomIndex]
}

const hashString = str => {
  if (typeof str !== 'string') return 0
  const length = str.length
  let hash = 0
  for (let i = 0; i < length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash
}

export function isOfClass (obj, className) {
  while ((obj = /** @type {object} */ (Reflect.getPrototypeOf(obj)))) {
    if (obj.constructor.name === className) return true
  }
  return false
}

const getImage = (item) => {
  const itemImage = item.img
  if (!isImageBoring(itemImage)) return itemImage
  const actorImage = item.actor?.token?.img || item.actor?.img
  if (!isImageBoring(actorImage)) return actorImage
  return randomImage(item)
}

const createEffect = (item) => {
  const ctrlOrAltPressed = game.keyboard.isModifierActive(KeyboardManager.MODIFIER_KEYS.CONTROL)
    || game.keyboard.isModifierActive(KeyboardManager.MODIFIER_KEYS.ALT)
  const createHidden = game.user.isGM && (ctrlOrAltPressed !== game.settings.get(MODULE_ID, 'hidden-by-default'))
  const durationText = item.system.duration ? item.system.duration.value : ''
  const descriptionText = item.system.description.value
  let durationValue, durationUnit, durationSustained
  if (item.system.frequency) {
    ({
      durationValue,
      durationUnit,
      durationSustained,
    } = getFrequency(item.system.frequency))
  } else {
    ({
      durationValue,
      durationUnit,
      durationSustained,
    } = getDuration(durationText, descriptionText))
  }
  const effectName = game.i18n.localize(
    MODULE_ID + (item.system.frequency ? '.addedPrefixToExpendedEffectName' : '.addedPrefixToEffectName'),
  ) + item.name
  const storedDescriptionText = game.i18n.localize(MODULE_ID + '.addedPrefixToEffectDescription') + descriptionText
  const image = getImage(item)
  return {
    type: 'effect',
    name: effectName,
    img: image,
    data: {
      tokenIcon: { show: true },
      duration: {
        value: durationValue,
        unit: durationUnit,
        sustained: durationSustained,
        expiry: 'turn-start',
      },
      description: {
        ...item.system.description,
        value: storedDescriptionText,
      },
      unidentified: createHidden,
      traits: item.system.traits,
      level: item.system.level,
      source: item.system.source,
      slug: `temporary-effect-${item.system.slug}`,
    },
    flags: {},
  }
}

const createEmptyEffect = () => {
  const screenPos = canvas.scene._viewPosition
  const altPressed = game.keyboard.isModifierActive(KeyboardManager.MODIFIER_KEYS.ALT)
  const createHidden = game.user.isGM && (altPressed !== game.settings.get(MODULE_ID, 'hidden-by-default'))
  const kindaRandomString = Math.round(screenPos.x + screenPos.y + screenPos.scale * 1000).toString()
  const image = randomImage({ id: kindaRandomString })
  return {
    type: 'effect',
    name: game.i18n.localize(MODULE_ID + '.nameOfQuickUntitledEffect'),
    img: image,
    data: {
      tokenIcon: { show: true },
      duration: {
        value: 1,
        unit: 'unlimited',
        sustained: false,
        expiry: 'turn-start',
      },
      description: {
        value: game.i18n.localize(MODULE_ID + '.descriptionOfQuickUntitledEffect'),
      },
      unidentified: createHidden,
      traits: {
        custom: '',
        rarity: 'common',
        value: [],
      },
      level: {
        value: 0,
      },
      source: {
        value: 'quick effect created by ' + MODULE_NAME,
      },
      // note: naming this just 'temporary-effect-...' will lead to a PF2E bug, apparently!
      slug: `extempore-temporary-effect-${kindaRandomString}`,
    },
    flags: {},
  }
}

const RANDOM_EFFECT_IMAGES = [
  'icons/magic/air/air-burst-spiral-large-blue.webp',
  'icons/magic/air/air-burst-spiral-large-pink.webp',
  'icons/magic/air/air-burst-spiral-large-teal-green.webp',
  'icons/magic/air/air-burst-spiral-large-yellow.webp',
  'icons/magic/air/fog-gas-smoke-swirling-blue.webp',
  'icons/magic/air/fog-gas-smoke-swirling-green.webp',
  'icons/magic/air/fog-gas-smoke-swirling-orange.webp',
  'icons/magic/air/fog-gas-smoke-swirling-pink.webp',
  'icons/magic/air/fog-gas-smoke-swirling-white.webp',
  'icons/magic/air/fog-gas-smoke-swirling-yellow.webp',
  'icons/magic/control/debuff-chains-blue.webp',
  'icons/magic/control/debuff-chains-green.webp',
  'icons/magic/control/debuff-chains-purple.webp',
  'icons/magic/control/debuff-chains-red.webp',
  'icons/magic/fire/explosion-fireball-medium-blue.webp',
  'icons/magic/fire/explosion-fireball-medium-orange.webp',
  'icons/magic/fire/explosion-fireball-medium-purple-orange.webp',
  'icons/magic/fire/explosion-fireball-medium-purple-pink.webp',
  'icons/magic/fire/explosion-fireball-medium-red-orange.webp',
  'icons/magic/light/beam-rays-blue-large.webp',
  'icons/magic/light/beam-rays-green-large.webp',
  'icons/magic/light/beam-rays-magenta-large.webp',
  'icons/magic/light/beam-rays-orange-large.webp',
  'icons/magic/light/beam-rays-red-large.webp',
  'icons/magic/light/beam-rays-teal-purple-large.webp',
  'icons/magic/light/beam-rays-yellow-blue-large.webp',
  'icons/magic/light/beams-rays-orange-purple-large.webp',
  'icons/magic/light/explosion-star-blue.webp',
  'icons/magic/light/explosion-star-orange-purple.webp',
  'icons/magic/light/explosion-star-orange.webp',
  'icons/magic/light/explosion-star-pink.webp',
  'icons/magic/light/explosion-star-teal-purple.webp',
  'icons/magic/light/explosion-star-teal.webp',
]
