const MODULE_ID = 'pf2e-extempore-effects'
const MODULE_NAME = 'pf2E Extempore Effects'
const LATEST_MIGRATION_VERSION = 3

const localize = (key) => game.i18n.localize(MODULE_ID + key)

Hooks.on('init', () => {
  libWrapper.register(
    MODULE_ID,
    'foundry.applications.sidebar.tabs.ChatLog.prototype._getEntryContextOptions',
    _getEntryContextOptions_Wrapper,
    'WRAPPER',
  )
  libWrapper.register(
    MODULE_ID,
    'foundry.helpers.GameTime.prototype.onUpdateWorldTime',
    onUpdateWorldTime_Wrapper,
    'WRAPPER',
  )
  game.settings.register(MODULE_ID, 'randomize-image-if-default', {
    name: localize('.settings.randomize-image-if-default.name'),
    hint: localize('.settings.randomize-image-if-default.hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  })
  game.settings.register(MODULE_ID, 'hidden-by-default', {
    name: localize('.settings.hidden-by-default.name'),
    hint: localize('.settings.hidden-by-default.hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  })
  const { CONTROL, SHIFT } = foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS
  game.keybindings.register(MODULE_ID, 'quick-add-empty-effect', {
    name: localize('.settings.quick-add-empty-effect.name'),
    hint: localize('.settings.quick-add-empty-effect.hint'),
    editable: [{ key: 'KeyE', modifiers: [CONTROL, SHIFT] }],
    onDown: quickAddEmptyEffect,
  })
  game.settings.register(MODULE_ID, 'open-effect-sheet-shortcut', {
    name: localize('.settings.open-effect-sheet-shortcut.name'),
    hint: localize('.settings.open-effect-sheet-shortcut.hint'),
    scope: 'client',
    config: true,
    type: String,
    default: 'shift_left_click',
    choices: {
      'shift_left_click': localize('.settings.open-effect-sheet-shortcut.choice_shift_left_click'),
      'ctrl_left_click': localize('.settings.open-effect-sheet-shortcut.choice_ctrl_left_click'),
      'disabled': localize('.settings.open-effect-sheet-shortcut.choice_disabled'),
    },
  })
  game.settings.register(MODULE_ID, 'notifications-for-expired-effects', {
    name: localize('.settings.notifications-for-expired-effects.name'),
    hint: localize('.settings.notifications-for-expired-effects.hint'),
    scope: 'world',
    config: true,
    type: String,
    default: 'all_effects',
    choices: {
      'all_effects': localize('.settings.notifications-for-expired-effects.choice_all_effects'),
      'only_unidentified': localize('.settings.notifications-for-expired-effects.choice_only_unidentified'),
      'disabled': localize('.settings.notifications-for-expired-effects.choice_disabled'),
    },
  })
  game.settings.register(MODULE_ID, 'notifications-sound-for-expired-effects', {
    name: localize('.settings.notifications-sound-for-expired-effects.name'),
    hint: localize('.settings.notifications-sound-for-expired-effects.hint'),
    scope: 'world',
    config: true,
    type: String,
    default: '',
    filePicker: true,
  })
  game.settings.register(MODULE_ID, 'notifications-pause-for-expired-effects', {
    name: localize('.settings.notifications-pause-for-expired-effects.name'),
    hint: localize('.settings.notifications-pause-for-expired-effects.hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  })
  game.settings.register(MODULE_ID, 'short-stage-badge', {
    name: 'Shorten "Stage 2" to e.g. "[2/6]" in effect badges',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
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
  if (migrationVersion < 3) {
    console.log(`${MODULE_NAME} | migrating settings...`)
    await migrateSettings()
    game.settings.set(MODULE_ID, 'migration-version', 3)
    console.log(`${MODULE_NAME} | migration version set to 3`)
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

const migrateSettings = async () => {
  const prevSetting = game.settings.get(MODULE_ID, 'open-effect-sheet-shortcut')
  const renamedMapping = {
    'Shift + Left-Click': 'shift_left_click',
    'Control + Left-Click': 'ctrl_left_click',
    'Disabled': 'disabled',
  }
  if (Object.keys(renamedMapping).includes(prevSetting)) {
    game.settings.set(MODULE_ID, 'open-effect-sheet-shortcut', renamedMapping[prevSetting])
  }
}

const isShiftHeld = () => game.keyboard.isModifierActive(
  foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.SHIFT,
)

const isCtrlHeld = () => game.keyboard.isModifierActive(
  foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.CONTROL,
)

const isAltHeld = () => game.keyboard.isModifierActive(
  foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.ALT,
)

/**
 * show effect sheets on shift-click (configurable: ctrl+click)
 */
Hooks.on('renderEffectsPanel', (_panel, panelEl, context, _options) => {
  const openEffectSheetShortcut = game.settings.get(MODULE_ID, 'open-effect-sheet-shortcut')
  let instructionStr
  if (openEffectSheetShortcut === 'shift_left_click') {
    instructionStr = localize('.openSheetInstructionShift')
  } else if (openEffectSheetShortcut === 'ctrl_left_click') {
    instructionStr = localize('.openSheetInstructionCtrl')
  } else {
    instructionStr = null
  }
  if (!instructionStr) {
    return  // not adding hotkey
  }
  const instructions = `<p>${instructionStr}</p>`
  // FIXME -- this is broken now, because the tooltip aside with the instructions does not render until the user hovers over it, and when it does there's no hook/even to use
  // so the following line of code will be useless :(
  document.querySelector('aside.pf2e.effect-info > .content > .instructions')?.append(instructions)

  panelEl.querySelectorAll('.effect-item[data-item-id] .icon').forEach((iconEl) => {
    iconEl.addEventListener('click', (event) => {
      const openEffectSheetShortcut = game.settings.get(MODULE_ID, 'open-effect-sheet-shortcut')
      if (openEffectSheetShortcut === 'shift_left_click' && !isShiftHeld()) return
      if (openEffectSheetShortcut === 'ctrl_left_click' && !isCtrlHeld()) return
      const id = event.currentTarget.closest('.effect-item[data-item-id]').dataset.itemId
      const { afflictions, conditions, effects, actor } = context
      const effect = effects.find(it => it.effect.id === id)?.effect
        || afflictions.find(it => it.effect.id === id)?.effect
        || conditions.find(it => it.effect.id === id)?.effect
        || actor.items.get(id)
      if (!effect) return
      // prevent normal PF2E click behavior, to make shift/ctrl click only open the sheet without increasing a counter
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      // open and display the sheet
      effect.sheet.render(true)
    }, true)
  })
})

// Wrap time-change functions so that the GM gets a notification on every Hidden condition that runs out of time
const onUpdateWorldTime_Wrapper = (wrapped, ...args) => {
  // if (!game.user.isGM) return wrapped(...args) // We have to move this check further down so player clocks stay in sync with GM clocks

  const effectsWithDurations = game.pf2e.effectTracker.effects
  if (!effectsWithDurations.length) return wrapped(...args)

  const oldWorldTime = game.time.worldTime
  const willExpirationDeleteEffects = game.settings.get('pf2e', 'automation.removeExpiredEffects')
  const effectNotificationSetting = game.settings.get(MODULE_ID, 'notifications-for-expired-effects')
  const requestedNewWorldTime = args[0]
  const requestedTimeDeltaS = requestedNewWorldTime - oldWorldTime
  // ignore time updates of 1 round (6 seconds);  because tracking expiration between rounds is very hard and usually doesn't require reminders
  if (requestedTimeDeltaS <= 6) {
    return wrapped(...args)
  }

  let newWorldTime = requestedNewWorldTime
  let expireEffectMessageShown = false

  // We don't want to go further in time than the next effect expiration or the requested time, which ever comes first
  // Lets iterate through the effects and find the first one that will expire before the requested time, respecting the notification settings
  if (game.settings.get(MODULE_ID, 'notifications-pause-for-expired-effects') && effectNotificationSetting !==
    'disabled') {
    let firstExpiringEffect = null
    for (const effect of effectsWithDurations) {
      if (effect.isExpired) continue
      const isSecretEffect = effect.system.unidentified
      if (effectNotificationSetting === 'only_unidentified' && !isSecretEffect) continue
      if (effect.remainingDuration.remaining <= 0) continue

      if ((oldWorldTime + effect.remainingDuration.remaining) <= requestedNewWorldTime) {
        firstExpiringEffect = effect
        break
      }
    }

    // We found an effect that will expire before the requested time, lets adjust the requested time to that
    if (firstExpiringEffect) {
      newWorldTime = oldWorldTime + firstExpiringEffect.remainingDuration.remaining
    }
  }

  args[0] = newWorldTime
  // Players will get their time to advance to this point, but won't get the extra dialog prompt
  if (!game.user.isGM) {
    return wrapped(...args)
  }

  const timeDeltaS = newWorldTime - oldWorldTime
  // pf2e has a luxon-based time system, very nice

  const oldWorldTimeLux = game.pf2e.worldClock.worldTime
  const newWorldTimeLux = oldWorldTimeLux.plus({ seconds: timeDeltaS })

  let effectsExpired = [] // lets store effects that expired for notification purposes
  let lastExpiryTime // let's store the last expiry time (nicely formated) for the prompt notification

  for (const effect of effectsWithDurations) {
    if (effectNotificationSetting === 'disabled') break
    if (effect.isExpired) continue

    const isSecretEffect = effect.system.unidentified
    if (!isSecretEffect && effectNotificationSetting === 'only_unidentified') continue

    const effectExpiryTimeLux = oldWorldTimeLux.plus({ seconds: effect.remainingDuration.remaining })
    const isEffectGonnaExpireNow = effectExpiryTimeLux.startOf('second') <= newWorldTimeLux.startOf('second')

    if (isEffectGonnaExpireNow) {
      effectsExpired.push(effect)
      expireEffectMessageShown = true

      // convert to Golarion time
      // TODO rely on system calendar in foundry v13
      const golS = effectExpiryTimeLux.plus({ years: 2700 }).toFormat('yyyy-LL-dd HH:mm:ss')
      lastExpiryTime = golS

      const durS = `${effect.system.duration.value} ${effect.system.duration.unit}`
      console.log(`${MODULE_NAME} | ${effect.name} expired now!  ID = ${effect.id}`)
      const actor = effect.actor
      const stashedEffectJSON = effect.toJSON()
      ui.notifications.info(`${isSecretEffect ? 'Secret effect' : 'Effect'} expired, see chat!    (${effect.name})`)
      // post effect description again (it's usually helpful)
      const effTypeName = isSecretEffect ? 'Secret effect' : 'Effect'
      const badge = effect.system.badge
      effect.toMessage(undefined, { rollMode: isSecretEffect ? 'gmroll' : undefined }).then(() => {
        // post special message explaining what just happened and adding a button to undo it if the effect was removed
        ChatMessage.create({
          user: game.user.id,
          speaker: { alias: 'Extempore Effects' },
          content: `
<h3>${effTypeName} expired!</h3>
<div><b>Name:</b> ${effect.name}</div>
<div><b>Actor:</b> ${actor.name}</div>
<div><b>Expired:</b> ${golS}</div>
<div><b>After duration:</b> ${durS}</div>
` + (badge ? `
<div><b>Badge:</b> ${badge.label ? badge.label : badge.value}</div>
` : ``) + `
` + (willExpirationDeleteEffects ? `
<br/>
<button id="extempore-reapply">Reapply ${effect.name} to ${actor.name}?</button>
<div>(This button will stop working after a refresh)</div>
` : ``),
          flags: { core: { canPopout: true } },
          whisper: isSecretEffect ? ChatMessage.getWhisperRecipients('GM') : [],
        }, {}).then(async chatMessage => {
          // add button interactivity (timeout is needed here.  also, button will stop working after refresh)
          setTimeout(() => {
            $(`li[data-message-id="${chatMessage.id}"] button#extempore-reapply`).click(() => {
              actor.createEmbeddedDocuments('Item', [stashedEffectJSON])
            })
          }, 500)
        })
      })
    }
  }

  // If there was an expired effect notification, and the user requested to advance time beyond the expiry time,
  // let's prompt the user if they want to continue to requested time or stop at the expiry time.
  if (expireEffectMessageShown && newWorldTime < requestedNewWorldTime) {
    const dialogTitle = `${localize('.dialog.expiredEffects.title')} ${lastExpiryTime}`
    let dialogContent = `<span><b>${localize('.dialog.expiredEffects.content.header')}</b><ul>`

    for (const effect of effectsExpired) dialogContent += `<li>${effect.name} (${effect.actor.name})</li>`

    dialogContent += `</ul>${localize('.dialog.expiredEffects.content.message-time')} ${formatTime(
      newWorldTime - oldWorldTime)}.</span><span>${localize(
      '.dialog.expiredEffects.content.message-continue')}<br>${formatTime(
      requestedNewWorldTime - newWorldTime)}?</span>`

    promptUserToContinue(requestedNewWorldTime, newWorldTime, oldWorldTime, dialogTitle, dialogContent)
  }

  // Play the notification sound if a chat notification was made
  const effectNotificationSoundSetting = game.settings.get(MODULE_ID, 'notifications-sound-for-expired-effects')
  if (expireEffectMessageShown && effectNotificationSoundSetting.trim() !== '') {
    foundry.audio.AudioHelper.play({ src: effectNotificationSoundSetting })
  }

  wrapped(...args)
}

const promptUserToContinue = async (requestedNewWorldTime, newWorldTime, oldWorldTime, dialogTitle, dialogContent) => {
  return foundry.applications.api.DialogV2.wait({
    window: {
      title: dialogTitle,
      icon: 'fa-regular fa-alarm-exclamation',
    },
    content: dialogContent,
    buttons: [
      {
        action: 'revertBack',
        label: localize('.dialog.expiredEffects.buttons.revertBack'),
        icon: 'fas fa-backward-fast',
        callback: async () => {
          await game.time.advance(0) // stupid hack, without this the time doesn't advance properly?
          await game.time.advance((oldWorldTime - newWorldTime))
        },
      }, {
        action: 'stopHere',
        label: localize('.dialog.expiredEffects.buttons.stopHere'),
        icon: 'fas fa-pause',
      }, {
        default: true,
        action: 'continueForward',
        label: localize('.dialog.expiredEffects.buttons.continueForward'),
        icon: 'fas fa-forward',
        callback: async () => {
          await game.time.advance(0) // stupid hack, without this the time doesn't advance properly?
          await game.time.advance((requestedNewWorldTime - newWorldTime))
        },
      }],
  }).catch(async () => {
    // on dialog dismiss, keep moving forward because the user probably missed this prompt and just wants to keep going
    await game.time.advance(0) // stupid hack, without this the time doesn't advance properly?
    await game.time.advance((requestedNewWorldTime - newWorldTime))
  })
}

function formatTime (seconds) {
  const weeks = Math.floor(seconds / (7 * 24 * 60 * 60))
  seconds %= 7 * 24 * 60 * 60
  const days = Math.floor(seconds / (24 * 60 * 60))
  seconds %= 24 * 60 * 60
  const hours = Math.floor(seconds / (60 * 60))
  seconds %= 60 * 60
  const minutes = Math.floor(seconds / 60)
  seconds %= 60

  const parts = []
  if (weeks > 0) parts.push(`${weeks} ${localize(weeks > 1 ? '.time.weeks' : '.time.week')}`)
  if (days > 0) parts.push(`${days} ${localize(days > 1 ? '.time.days' : '.time.day')}`)
  if (hours > 0) parts.push(`${hours} ${localize(hours > 1 ? '.time.hours' : '.time.hour')}`)
  if (minutes > 0) parts.push(`${minutes} ${localize(minutes > 1 ? '.time.minutes' : '.time.minute')}`)
  if (seconds > 0) parts.push(`${seconds} ${localize(seconds > 1 ? '.time.seconds' : '.time.second')}`)

  const allParts = parts.join(', ')

  return ` <em>${allParts}</em>`
}

const quickAddEmptyEffect = async () => {
  const tokens = canvas.tokens.controlled
  if (tokens.length !== 1) {
    ui.notifications.error(localize('.errorMultipleTokensCustomEffect'))
  } else {
    const effect = createEmptyEffect()
    const token = tokens[0]
    if (!token.actor) {
      ui.notifications.error(`Token "${token.name}" has no actor, and so cannot have an effect.`)
      return
    }
    const effectItems = await token.actor.createEmbeddedDocuments('Item', [effect])
    effectItems[0].sheet.render(true)
  }
}

const _getEntryContextOptions_Wrapper = (wrapped) => {
  const buttons = wrapped.bind(this)()

  // Add a button
  buttons.unshift(
    {
      name: localize('.contextMenuExtemporeEffect'),
      icon: '<i class="fas fa-star"></i>',
      condition: li => {
        const message = game.messages.get(li.dataset['messageId'])
        if (isEffectOrCondition(message.item) || isEffectOrCondition(message.getFlag('pf2e', 'origin'))) {
          return false
        }
        if (isRechargeRoll(message)) {
          return true
        }
        if (isNormalTextMessage(message)) {
          return true
        }
        return !!message.item || !!messageGetOriginUuid(message)
      },
      callback: async li => {
        const tokens = canvas.tokens.controlled
        if (tokens.length === 0)
          return ui.notifications.error(localize('.errorNoTokensSelected'))
        const message = game.messages.get(li.dataset['messageId'])
        const messageOriginUuid = messageGetOriginUuid(message)
        let item = message.item ?? null
        if (messageOriginUuid)
          item = await fromUuid(messageOriginUuid)

        let effect
        if (item !== null) {
          effect = await createEffect(item)
        } else if (isRechargeRoll(message)) {
          effect = createEffectFromRechargeRoll(message)
        } else if (isNormalTextMessage(message)) {
          effect = createEffectFromPureTextMessage(message)
        } else {
          if (message.flags?.pf2e?.origin?.type === 'consumable') {
            // consumable was used, so fromUuid returned null (item has been removed from its actor)
            // but we can try to use the compendium item instead!
            // e.g. "Actor.o4zcDbHha6glH9IP.Item.hDLbR56Id2OtU318"
            // let's convert to e.g. "Compendium.pf2e.equipment-srd.Item.hDLbR56Id2OtU318"
            const uuidSplit = message.getFlag('pf2e', 'origin').
              uuid.replace(message.getFlag('pf2e', 'origin').actor + '.', '').
              split('.')
            if (uuidSplit.length === 2 && uuidSplit[0] === 'Item') {
              const itemUuidInEquipmentSrd = `Compendium.pf2e.equipment-srd.Item.${uuidSplit[1]}`
              item = await fromUuid(itemUuidInEquipmentSrd)
            }
            if (item === null) {
              console.log(`${MODULE_NAME} | creating effect from used consumable, so item automation isn't so good`)
              effect = createEffectFromItemlessMessage(message)
            } else {
              // nice, we're back in business
              effect = await createEffect(item)
            }
          } else if (message.flags?.pf2e?.origin?.type === 'spell') {
            // similar situation, but spell scroll consumed, and uuid is useless
            console.log(`${MODULE_NAME} | creating effect from consumed spell, so item automation isn't so good`)
            effect = createEffectFromItemlessMessage(message)
          } else {
            ui.notifications.warn(localize('.errorItemNotFound'))
            effect = createEffectFromItemlessMessage(message)
          }
        }
        const openEffectSheetShortcut = game.settings.get(MODULE_ID, 'open-effect-sheet-shortcut')
        let isModifierKeyPressed
        switch (openEffectSheetShortcut) {
          case 'shift_left_click':
            isModifierKeyPressed = isShiftHeld()
            break
          case 'ctrl_left_click':
            isModifierKeyPressed = isCtrlHeld()
            break
          case 'disabled':
            isModifierKeyPressed = false
            break
        }
        for (const token of tokens) {
          if (!token.actor) {
            ui.notifications.error(`Token "${token.name}" has no actor, and so cannot have an effect.`)
            continue
          }
          const effectItems = await token.actor.createEmbeddedDocuments('Item', [effect])
          if (isModifierKeyPressed) {
            effectItems[0].sheet.render(true)
          }
        }
      },
    },
    // Special case for "Effect" item messages;  though it's very unlikely they'll actually be put in chat
    // (this option and the previous option will never both be available)
    {
      name: localize('.contextMenuApplyEffect'),
      icon: '<i class="fas fa-star"></i>',
      condition: li => {
        const message = game.messages.get(li.dataset['messageId'])
        if (isEffectOrCondition(message.item)) return true
        if (isEffectOrCondition(message.getFlag('pf2e', 'origin'))) {
          const item = fromUuidNonAsync(messageGetOriginUuid(message))
          return !!item
        }
        return false
      },
      callback: async li => {
        const tokens = canvas.tokens.controlled
        if (tokens.length === 0)
          return ui.notifications.error(localize('.errorNoTokensSelected'))
        const message = game.messages.get(li.dataset['messageId'])
        const messageOriginUuid = messageGetOriginUuid(message)
        const item = message.item || (messageOriginUuid && await fromUuid(messageOriginUuid)) || null
        if (item === null) {
          return ui.notifications.error(localize('.errorItemNotFound'))
        }
        for (const token of tokens) {
          if (!token.actor) {
            ui.notifications.error(`Token "${token.name}" has no actor, and so cannot have an effect.`)
            continue
          }
          await token.actor.createEmbeddedDocuments('Item', [item.toObject()])
        }
      },
    },
  )
  return buttons
}

function messageGetOriginUuid (message) {
  let uuid = message.getFlag('pf2e', 'origin')?.uuid
  if (!uuid) {
    return null
  }
  if (uuid.startsWith('Actor..')) {
    // bugfix for Dorako UI module, which adds a "💬Send" button which does this
    uuid = uuid.replace('Actor..', '')
  }
  return uuid
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

function defineDurationFromFrequency (frequency) {
  let durationValue, durationUnit, durationSustained = false
  const turnStartOrTurnEnd = 'turn-start'
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
  return { durationSustained, durationUnit, durationValue, turnStartOrTurnEnd }
}

const defineDurationFromTextOfAffliction = (itemDescriptionText) => {
  // an affliction effect's duration is the duration of its first stage!
  // example: '<p><strong>Stage 1</strong> carrier with no ill effect (1 minute)</p>'
  const stageNRegex = new RegExp(`<p>\\s*<strong>\\s*${localize('.stageN').replace('{n}', '\\d+')}<\/strong> .+? \\((.+)\\)\\s*<\/p>`,
    'i')
  const firstStageDurationMatch = itemDescriptionText.match(stageNRegex)
  const maximumDurationMatch = itemDescriptionText
    // example: '<p><strong>Maximum Duration</strong> 6 rounds</p>'
    .match(/<p>\s*<strong>\s*Maximum Duration<\/strong> (\d+ rounds?)\s*<\/p>/)
  // defaults to maximum duration
  const chosenDurationText = maximumDurationMatch?.[1] ?? firstStageDurationMatch?.[1] ?? ''
  const durationObj = defineDurationFromText(chosenDurationText, itemDescriptionText)
  return {
    ...durationObj,
    // tick down at end of turn rather than start of turn, afflictions are special this way
    turnStartOrTurnEnd: 'turn-end',
  }
}

const defineDurationFromText = (durationText, descriptionText) => {
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
  } else if (itemDuration.includes('daily preparation')) {
    // "until the next time you make your daily preparations"
    durationValue = 1
    durationUnit = 'days'
    durationSustained = false
  } else if (itemDuration.includes(' ')) {
    // "10 minutes", or possibly something weird
    durationValue = parseInt(itemDuration.split(' ')[0])
    durationUnit = itemDuration.split(' ')[1]
    if (!durationUnit.endsWith('s')) durationUnit += 's'  // e.g. "minutes"
    durationSustained = false
  } else if (itemDuration === '') {
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
    turnStartOrTurnEnd: 'turn-start',
  }
}

const isEffectOrCondition = (document) => {
  return document?.type === 'effect' || document?.type === 'condition'
}

const isAffliction = (itemDescriptionText) => {
  const stageNRegex = new RegExp(`<strong>${localize('.stageN').replace('{n}', '\\d')}+`)
  return itemDescriptionText.match(stageNRegex)
}

const isRechargeRoll = (message) => {
  return !isNaN(parseInt(message.content)) && message.flavor?.includes('charge')
}

const isNormalTextMessage = (message) => {
  return !!message.content?.length && !message.isRoll && Object.keys(message.system ?? {}).length === 0 &&
    !message.content?.includes('<div')
}

const calcHighestStageOfAffliction = (itemDescriptionText) => {
  const stageNRegex = new RegExp(localize(`.stageN`).replace('{n}', '(\\d+)'), 'gi')
  const stageNumbers = [...itemDescriptionText.matchAll(stageNRegex)].map(m => m[1]).
    map(numStr => parseInt(numStr))
  return Math.max(...stageNumbers)
}

const isImageBoring = (image) => {
  return !image || image.startsWith('systems/pf2e/icons/actions')
    || image.startsWith('systems/pf2e/icons/default-icons')
    || image === 'systems/pf2e/icons/features/feats/feats.webp'
}

const randomImage = (rawSeed) => {
  const hashNum = hashString(rawSeed?.toString())
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
  const itemImage = item.img
  if (!isImageBoring(itemImage)) return itemImage
  const actorImage = item.actor?.token?.img || item.actor?.img
  if (!isImageBoring(actorImage)) return actorImage
  return randomImage(item.id)
}

const placeCheckButtonsInItemDescription = (item, enrichedContentDescription) => {
  let description = enrichedContentDescription
  const dc = item.spellcasting?.statistic.dc.value
  if (!dc) return description
  for (const saveName of ['Fortitude', 'Will', 'Reflex']) {
    const type = saveName.toLowerCase()
    const name = `${saveName} save`
    description = description.replaceAll(
      new RegExp(` ${saveName} (saves|save|saving throw)`, 'g'),
      ` @Check[type:${type}|dc:${dc}]{${name}}`,
    ).replaceAll(
      // e.g. <strong>Defense</strong> Will;
      new RegExp(`\\n\\s+${saveName};`, 'g'),
      `\n @Check[type:${type}|dc:${dc}]{${name}};`,
    )
  }
  for (const checkName of [
    'Acrobatics',
    'Arcana',
    'Athletics',
    'Crafting',
    'Deception',
    'Diplomacy',
    'Intimidation',
    'Medicine',
    'Nature',
    'Occultism',
    'Performance',
    'Religion',
    'Society',
    'Stealth',
    'Survival',
    'Thievery',
  ]) {
    const type = checkName.toLowerCase()
    const name = `${checkName} check`
    description = description.replaceAll(
      new RegExp(` ${checkName} check(?!s)`, 'g'),
      ` @Check[type:${type}|dc:${dc}]{${name}}`,
    )
  }
  return description
}

const addPrefixAndOriginToDescription = (description, item) => {
  if (!item || !item.uuid || !item.name)
    return localize('.addedPrefixToEffectDescription') + description
  const itemEmbed = `@UUID[${item.uuid}]{${item.name}}`
  const owner = item.actor
  if (!owner || !owner.uuid || !owner.name)
    return localize('.addedPrefixWithOriginToEffectDescription').replace('{ORIGIN}', `${itemEmbed}`) + description
  const ownerEmbed = `@UUID[${owner.uuid}]{${owner.name}}`
  return localize('.addedPrefixWithOriginToEffectDescription').replace('{ORIGIN}', `${ownerEmbed} > ${itemEmbed}`) +
    description
}

const createEffect = async (item) => {
  const ctrlOrAltPressed = isCtrlHeld() || isAltHeld()
  const createHidden = game.user.isGM && (ctrlOrAltPressed !== game.settings.get(MODULE_ID, 'hidden-by-default'))
  const durationText = item.system.duration ? item.system.duration.value : ''
  const { enrichedContent } = await item.sheet.getData()
  const originalDescription = enrichedContent.description
  let durationValue, durationUnit, durationSustained, turnStartOrTurnEnd
  let itemBadge = undefined
  if (isAffliction(originalDescription)) {
    ({
      durationValue,
      durationUnit,
      durationSustained,
      turnStartOrTurnEnd,
    } = defineDurationFromTextOfAffliction(originalDescription))
    // Afflictions get created at Stage 1
    const highestStage = calcHighestStageOfAffliction(originalDescription)
    const stageTextFromNumber = game.settings.get(MODULE_ID, 'short-stage-badge')
      ? (n) => `[${n}/${highestStage}]`
      : (n) => localize(`.stageN`).replace('{n}', n)
    itemBadge = {
      type: 'counter',
      value: 1,
      labels: Array.fromRange(highestStage, 1).map(n => stageTextFromNumber(n)),
    }
  } else if (item.system.frequency) {
    ({
      durationValue,
      durationUnit,
      durationSustained,
      turnStartOrTurnEnd,
    } = defineDurationFromFrequency(item.system.frequency))
  } else {
    ({
      durationValue,
      durationUnit,
      durationSustained,
      turnStartOrTurnEnd,
    } = defineDurationFromText(durationText, originalDescription))
  }
  const effectName = localize(
    item.system.frequency
      ? '.addedPrefixToExpendedEffectName'
      : '.addedPrefixToEffectName',
  ) + item.name
  let descriptionText = placeCheckButtonsInItemDescription(item, originalDescription)
  descriptionText = addPrefixAndOriginToDescription(descriptionText, item)
  const image = getImage(item)
  const effectLevel = item.system.level || item.parent?.system.details.level
  return {
    type: 'effect',
    name: effectName,
    img: image,
    system: {
      tokenIcon: { show: true },
      duration: {
        value: durationValue,
        unit: durationUnit,
        sustained: durationSustained,
        expiry: turnStartOrTurnEnd,
      },
      description: {
        gm: enrichedContent.gmNotes,
        value: descriptionText,
      },
      unidentified: createHidden,
      level: effectLevel,
      source: item.system.source,
      slug: `temporary-effect-${item.system.slug}`,
      badge: itemBadge,
    },
    flags: {},
  }
}

const defineRechargeUnit = (text) => {
  const rechargeText = text || ''
  let rechargeUnit
  if (rechargeText.toLowerCase().includes('days')) {
    rechargeUnit = 'days'
  } else if (rechargeText.toLowerCase().includes('hours')) {
    rechargeUnit = 'hours'
  } else if (rechargeText.toLowerCase().includes('minutes')) {
    rechargeUnit = 'minutes'
  } else {
    rechargeUnit = 'rounds'
  }
  console.log(`${MODULE_NAME} | ${rechargeUnit}`)
  return rechargeUnit
}

const createEffectFromRechargeRoll = (message) => {
  const rechargeRemaining = parseInt(message.content)
  const rechargeUnit = defineRechargeUnit(message.flavor)
  const createHidden = game.user.isGM
  const descriptionText = `${message.flavor} -- rolled ${message.content}`
  const effectName = localize('.addedPrefixToEffectName') + message.flavor
  const storedDescriptionText = addPrefixAndOriginToDescription(descriptionText, null)
  return {
    type: 'effect',
    name: effectName,
    img: RECHARGE_IMAGE,
    system: {
      tokenIcon: { show: true },
      duration: {
        value: rechargeRemaining,
        unit: rechargeUnit,
        sustained: false,
        expiry: 'turn-start',
      },
      description: {
        value: storedDescriptionText,
      },
      unidentified: createHidden,
      level: { value: 0 },
      slug: `temporary-effect-recharge-${rechargeRemaining}`,
    },
    flags: {},
  }
}

/**
 * This should ideally never be called;  if the button is available, the item should always* be found, otherwise it
 * needs to fit one of the other options (recharge roll, pure text).
 *
 * *but still, right now we have to call this for consumed consumable items (after the user Uses them the item disappears
 * from the actor that owned it).
 */
const createEffectFromItemlessMessage = (message) => {
  const ctrlOrAltPressed = isCtrlHeld() || isAltHeld()
  const createHidden = game.user.isGM && (ctrlOrAltPressed !== game.settings.get(MODULE_ID, 'hidden-by-default'))
  const $content = $('<div>' + (message.content.length > 2 ? message.content : message.flavor) + '</div>')
  const descriptionText = $content.find('.card-content').html() || $content.text()
  const $header = $content.find('header.card-header')
  const maybeItemName = $header.find('h3')[0]?.innerHTML.replace(/<span class="action-glyph">\d<\/span>/, '').trim()
  const maybeItemImage = $header.find('img').attr('src')
  const rollOptions = message.flags.pf2e?.origin?.rollOptions
  const maybeItemLevelStr = rollOptions?.find(rollOpt => rollOpt.startsWith('origin:item:level:'))?.split(':').pop()
  const maybeItemSlug = rollOptions?.find(rollOpt => rollOpt.startsWith('origin:item:slug:'))?.split(':').pop()

  const extraInfo = (
    $content.find('.action').text() + ' ' + $content.find('.degree-of-success span:first-child').text()
  ) || message.speaker.alias
  const effectName = localize('.addedPrefixToEffectName') + (maybeItemName ?? `??? (${extraInfo})`)
  const effectDescription = addPrefixAndOriginToDescription(descriptionText, null)
  const effectImage = (maybeItemImage && !isImageBoring(maybeItemImage))
    ? maybeItemImage
    : randomImage(message.timestamp)
  const effectSlug = maybeItemSlug ?? `extempore-itemless-effect-${message.timestamp}`
  const effectLevel = parseInt(maybeItemLevelStr ?? '0')

  let durationValue, durationUnit, durationSustained, turnStartOrTurnEnd
  let afflictionBadge = undefined
  if (isAffliction(descriptionText)) {
    ({
      durationValue,
      durationUnit,
      durationSustained,
      turnStartOrTurnEnd,
    } = defineDurationFromTextOfAffliction(descriptionText))
    // Afflictions get created at Stage 1
    const highestStage = calcHighestStageOfAffliction(descriptionText)
    const stageTextFromNumber = game.settings.get(MODULE_ID, 'short-stage-badge')
      ? (n) => `[${n}/${highestStage}]`
      : (n) => localize(`.stageN`).replace('{n}', n)
    afflictionBadge = {
      type: 'counter',
      value: 1,
      labels: Array.fromRange(highestStage, 1).map(n => stageTextFromNumber(n)),
    }
  } else {
    ({
      durationValue,
      durationUnit,
      durationSustained,
      turnStartOrTurnEnd,
    } = defineDurationFromText('', descriptionText))
  }
  return {
    type: 'effect',
    name: effectName,
    img: effectImage,
    system: {
      tokenIcon: { show: true },
      duration: {
        value: durationValue,
        unit: durationUnit,
        sustained: durationSustained,
        expiry: turnStartOrTurnEnd,
      },
      description: { value: effectDescription },
      unidentified: createHidden,
      level: { value: effectLevel },
      source: { value: 'itemless effect created by ' + MODULE_NAME },
      slug: effectSlug,
      badge: afflictionBadge,
    },
    flags: {},
  }
}

const createEmptyEffect = () => {
  const screenPos = canvas.scene._viewPosition
  const altPressed = isAltHeld()
  const createHidden = game.user.isGM && (altPressed !== game.settings.get(MODULE_ID, 'hidden-by-default'))
  const kindaRandomString = Math.round(screenPos.x + screenPos.y + screenPos.scale * 1000).toString()
  const image = randomImage(kindaRandomString)
  return {
    type: 'effect',
    name: localize('.nameOfQuickUntitledEffect'),
    img: image,
    system: {
      tokenIcon: { show: true },
      duration: {
        value: 1,
        unit: 'unlimited',
        sustained: false,
        expiry: 'turn-start',
      },
      description: {
        value: localize('.descriptionOfQuickUntitledEffect'),
      },
      unidentified: createHidden,
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

const createEffectFromPureTextMessage = (message) => {
  const improvisedName = message.content.length < 20 ? message.content : message.content.substring(0, 20) + '...'
  const descriptionText = addPrefixAndOriginToDescription(message.content, null)
  const ctrlOrAltPressed = isCtrlHeld() || isAltHeld()
  const createHidden = game.user.isGM && (ctrlOrAltPressed !== game.settings.get(MODULE_ID, 'hidden-by-default'))
  const image = randomImage(message.timestamp)
  return {
    type: 'effect',
    name: improvisedName,
    img: image,
    system: {
      tokenIcon: { show: true },
      duration: {
        value: 1,
        unit: 'unlimited',
        sustained: false,
        expiry: 'turn-start',
      },
      description: {
        value: descriptionText,
      },
      unidentified: createHidden,
      level: {
        value: 0,
      },
      source: {
        source: { value: 'itemless effect created by ' + MODULE_NAME },
      },
      slug: `extempore-text-message-effect-${message.timestamp}`,
    },
    flags: {},
  }
}

const RECHARGE_IMAGE = 'icons/magic/symbols/symbol-lightning-bolt.webp'

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

window.pf2eExtempore = {
  createEffect,
  createEffectFromPureTextMessage,
  createEffectFromRechargeRoll,
  createEffectFromItemlessMessage,
}