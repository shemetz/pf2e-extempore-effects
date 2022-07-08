const MODULE_ID = 'pf2e-extempore-effects'
const MODULE_NAME = 'pf2E Extempore Effects'

Hooks.on('init', () => {
  libWrapper.register(
    MODULE_ID,
    'ChatLog.prototype._getEntryContextOptions',
    _getEntryContextOptions_Wrapper,
    'WRAPPER',
  )
  game.settings.register(MODULE_ID, 'randomize-image-if-default', {
    name: `Prefer random images over default images`,
    hint: `Default true:  when creating an effect out of a message that has an item but no actor (or has an actor with
    the default art), and that item has default art, pick a random colorful effect image instead.`,
    scope: 'world',
    config: false,
    type: Boolean,
    default: true,
  })
  const { CONTROL, SHIFT } = KeyboardManager.MODIFIER_KEYS
  game.keybindings.register(MODULE_ID, 'quick-add-empty-effect', {
    name: 'Quick add empty effect',
    hint: 'Create a new custom effect with a random icon, applied to the currently selected token',
    editable: [{ key: 'KeyE', modifiers: [CONTROL, SHIFT] }],
    onDown: quickAddEmptyEffect,
  })
})

const quickAddEmptyEffect = async () => {
  const tokens = canvas.tokens.controlled
  if (tokens.length !== 1) {
    ui.notifications.warn(`You need to have one token selected to apply a custom new effect.`)
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
      name: 'Extempore Effect',
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
        const item = message.item || (message.getFlag('pf2e', 'origin') ? await fromUuid(message.getFlag('pf2e', 'origin').uuid) : null)
        if (item === null) {
          return ui.notifications.warn(`Item not found in PF2e message.`)
        }
        const shiftPressed = game.keyboard.isModifierActive(KeyboardManager.MODIFIER_KEYS.SHIFT)
        const effect = createEffect(item)
        const tokens = canvas.tokens.controlled
        if (tokens.length === 0) {
          ui.notifications.warn(`You need to have token(s) selected to apply the effect.`)
        } else for (const token of tokens) {
          const effectItems = await token.actor.createEmbeddedDocuments('Item', [effect])
          if (shiftPressed) {
            effectItems[0].sheet.render(true)
          }
        }
      }
    },
    // Special case for "Effect" item messages;  though it's very unlikely they'll actually be put in chat
    // (this option and the previous option will never both be available)
    {
      name: 'Apply Effect',
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
        const item = message.item || (message.getFlag('pf2e', 'origin') ? await fromUuid(message.getFlag('pf2e', 'origin').uuid) : null)
        if (item === null) {
          return ui.notifications.warn(`Item not found in PF2e message.`)
        }
        const tokens = canvas.tokens.controlled
        if (tokens.length === 0) {
          ui.notifications.warn(`You need to have token(s) selected to apply the effect.`)
        } else for (const token of tokens) {
          await token.actor.createEmbeddedDocuments('Item', [item.toObject()])
        }
      }
    }
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

const getImage = (item) => {
  const itemImage = item.data.img
  if (!isImageBoring(itemImage)) return itemImage
  const actorImage = item.actor?.token?.data?.img || item.actor?.data?.token?.img || item.actor?.img
  if (!isImageBoring(actorImage)) return actorImage
  return randomImage(item)
}

const createEffect = (item) => {
  const durationText = item.data.data.duration ? item.data.data.duration.value : ''
  const descriptionText = item.data.data.description.value
  const { durationValue, durationUnit, durationSustained } = getDuration(durationText, descriptionText)
  const image = getImage(item)
  return {
    type: 'effect',
    name: `Effect: ${item.name}`,
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
        ...item.data.data.description,
        value: `<h2>(Generated Effect)</h2>\n${descriptionText}`,
      },
      traits: item.data.data.traits,
      level: item.data.data.level,
      source: item.data.data.source,
      slug: `temporary-effect-${item.data.data.slug}`,
    },
  }
}

const createEmptyEffect = () => {
  const screenPos = canvas.scene._viewPosition
  const kindaRandomString = (screenPos.x + screenPos.y + screenPos.scale * 1000).toString()
  const image = randomImage({ id: kindaRandomString })
  return {
    type: 'effect',
    name: `Quick_untitled_effect`,
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
        value: `<h2>(Generated Effect)</h2>\nWrite whatever you want in here!`,
      },
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
      slug: `temporary-effect-${kindaRandomString}`,
    },
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
