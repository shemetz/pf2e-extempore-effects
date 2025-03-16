# [pf2E Extempore Effects](https://foundryvtt.com/packages/pf2e-extempore-effects/)

![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/shemetz/pf2e-extempore-effects?style=for-the-badge)
![GitHub Releases](https://img.shields.io/github/downloads/shemetz/pf2e-extempore-effects/latest/total?style=for-the-badge)
![GitHub All Releases](https://img.shields.io/github/downloads/shemetz/pf2e-extempore-effects/total?style=for-the-badge&label=Downloads+total)
![Latest Supported Foundry Version](https://img.shields.io/endpoint?url=https://foundryshields.com/version?url=https://github.com/shemetz/pf2e-extempore-effects/raw/master/module.json)

FoundryVTT module for the PF2e system, which allows creating temporary Effects from chat messages, to easily mark tokens
as affected by a spell/action/item that doesn't normally have embedded effects.

To install, browse for it in the module browser,
or [directly copy the manifest link for the latest release](https://github.com/shemetz/pf2e-extempore-effects/releases/latest/download/module.json)
.

# Features

### Message right-click context menu option, "Extempore Effect", to convert a message into an effect
To use, select one or more tokens and then right-click on a message in the chat. An option, "Extempore Effect", should
appear. Clicking that option will grant a new Effect to all controlled tokens.

The Effect will have its name, description, level, traits, etc. match the message's item ("item" here being a spell,
an action, a feat, a weapon, etc.). The duration will usually fit if possible (required some hardcoding and doesn't
cover all bases).  Afflictions will always start at Stage 1 and will expire after Stage 1's duration has passed.

The image will fit the item too, but not if it's a "default image" (like the default feat icon or
any of the simple 1/2/3-action icons). To avoid having several Effects with the same image (and avoid the boring
default images), this module will either use the image of the original item's token/actor, or will randomly pick a
simple colored image.

As a bonus feature, right-clicking actual Effect messages will display an "Apply Effect" option to just apply that same
effect to the controlled token. This is just a quality-of-life feature.

### Affliction automation (very partial)

When you create an effect from an affliction chat message - such as the one from Scalathrax Venom - the module will
attempt to give the effect a list of stages equal to the affliction's stage count, set the initial stage to 1, set
the duration to the first stage's duration, and set the expiration to the end of the turn.  These, altogether, **do not
automate affliction tracking** - but they should at least help keep track of things nicely until the core system support
is added.

### Shift+clicking the "Extempore Effect" option, to also open the effect's sheet
If you hold the Shift button, the effect's sheet will be opened up for you to see and edit, after being applied.
You can configure to use Ctrl instead of Shift, or to disable this behavior, in the module settings.

This is useful if you want to quickly edit the effect - for example:

- Rename Mirror Image to "Effect: Mirror Image **(3)**" **(note:  less needed now that we have core Counter support)**
- Change Steal Shadow's duration from Unlimited to 2 hours.
- Change Arsenic's image from the picture of a powder to a picture of deadly poison.

### Shift+clicking an effect in the effects panel, to edit it
You can shift+click an existing effect icon in the panel that appears in the top right corner of the screen, when
controlling a token.  This will open the sheet of that effect/condition, allowing you to read it and edit it.  Useful if
you want to get a refresher about its rules, or to edit a small detail about it.

This is less useful now that the core pf2e system allows editing effects from the effects panel.

### Ctrl+Shift+E (editable) keybinding, to create an empty effect
This new keybinding, "Quick create empty effect", will do something similar to the Extempore Effect except with fully
empty contents (not based on any message), also immediately opening the sheet for you to edit.  The name will be
untitled and the image will be a random icon (the randomness depends on screen position, so if you don't pan or zoom
around you can keep creating random effects with the same icon, which is sometimes handy).

### Notifications for expired effects
By default, this will only notify the GM about secret (unidentified) effects, though there is a setting to make it
notify for all effects. When it triggers, it will both create a notification and create a chat message detailing which
effect expired, what its duration was, which actor it applied to, and so on.  If you have the PF2E automation setting
for "remove expired effects" turned on, then this message will also include a button to reapply the just-removed effect.

Note that this will not work for tiny 1-round time changes (which happens in combat), because of technical difficulties.
However, this is probably not a problem for you - if you have an effect with a duration measured in rounds, you probably
aren't going to forget about it.

### Pop-up when effects expire, to stop advancing time
Optional setting (disabled by default), "Pause clock advancement to first expired effect".  You can choose to limit it
only to unidentified (secret) effects, too.  When an effect expires, the clock will stop advancing until you click one
of the buttons:  revert to initial time (undo advancement), stop here, or continue moving time forward.

# Settings & Extras

### Secret effects - hold Alt/Ctrl to create an unidentified effect or change the default behavior in the setting

The "Create unidentified effects by default" setting can be used to change this default behavior, in which case all new
extempore effects will be unidentified *unless* you hold Alt/Ctrl.

### Random abstract color images for default-image effects

A lot of pf2e items, feats, features, etc have no image, so instead of using that uninteresting default icon this module
will pick a random abstract color image from the core foundry magic icons.  You can change this behavior with the
"Prefer random images over default images" setting.

### Shorter "stage" badges

The setting called 'Shorten "Stage 2" to e.g. "\[2/6\]" in effect badges' will do... that.  It may be useful if you use
particular CSS themes that have less space for text in them (in the top right effects area).


# Demo gif

![](metadata/ee_demo_3.gif)
