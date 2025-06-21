## 1.10.3 - 2025-06-21
- Improved handling of consumed consumables that come from equipment-srd (#46)

## 1.10.2 - 2025-06-20
- Added embedded origin links to description (actor and item)
- Added other recharge units, thanks @a.turowskiy!
- Reduced warnings by fixing several small code bugs
- Maybe fixed a real bug, maybe not

## 1.10.0 - 2025-05-11
- Updated to V13+ core Foundry compatibility
- Fixed ctrl/shift effect opening shortcut (it always used either, ignored setting)
- Removed the instruction text for the effect opening shortcut in the effects panel -- the pf2e v7 code now uses
a tooltip so this is no longer easy to add to the rendered list of shortcuts (let me know if you find out otherwise).

## 1.9.1 - 2025-04-17
- Added API (window.pf2eExtempore) (#48)

## 1.9.0 - 2025-03-16
- Added "stop the clock" feature (optional setting), which will pause time-advancement when an effect expires

## 1.8.99 - 2025-02-18
- Fixed said versioning bug

## 1.8.9 - 2025-01-03
- Added a versioning bug
 
## 1.8.10 - 2025-02-18
- Added extemporability to all basic chat messages

## 1.8.8 - 2025-01-03
- Removed lock file from git repo (how the heck did I not notice this for 2.5 years?)
- Improved itemless effect name a little, now says e.g. "??? (Will Saving Throw Failure)"
- Improved embedded check button replacement in item-based descriptions (#42)

## 1.8.6 - 2024-08-08
- Fixed (added) effects from consumed items (e.g. poisons)

## 1.8.5 - 2024-06-27
- Improved detection of affliction stages for localizations, not perfectly (#40)

## 1.8.4 - 2024-06-15
- Fixed compatibility with pf2e version ~6.0 (not sure exactly which one)
- Marked as verified compatible with Foundry V12
- Re-added setting to only show expiring unidentified effects and not other effects (#34)
- Updated translations

## 1.8.3 - 2024-01-17
- Fixed stage detection from text

## 1.8.2 - 2023-12-12
- Fixed stage detection from text

## 1.8.1 - 2023-12-03
- Fixed descriptions not depending on Elite/Weak adjustments on creatures, and added GM notes (#33)
- Improved "Stage 1" text - can now be e.g. "[1/3]" (#30)
- Added German translations
- Added Polish translations

## 1.8.0 - 2023-10-22
- Added affliction badges (Stage 1 by default) and will rely on stage 1 duration (rather than Maximum Duration)
- Stopped creating chat messages for expired effects in combat (until now this happened in start of initiative which was bad) (#29)
- Changed affliction effects to expire at end of turn rather than the default of start of turn (#29)
- Added extemporability to Recharge Breath Weapon rolls (#28) 

## 1.7.4 - 2023-10-04
- Fixed error with certain effects that should last a day ("daily preparations")

## 1.7.3 - 2023-07-11
- Added error message when user tries to add an effect to an unlinked token
- Fixed integration bug with Dorako UI's "Send" header button

## 1.7.2 - 2023-06-15
- Added embedded save/check buttons to spells and items that benefit from them (#27)

## 1.7.0 - 2023-02-24
- Added automatic notifications and messages for expired unidentified effects (#5)
- [1.7.1] Fixed double notification

## 1.6.6 - 2023-02-17
- Fixed counters being added when shift-clicking effects in panel
- Fixed "Apply Effect" not showing up for Conditions

## 1.6.5 - 2023-02-13
- Fixed effects not being generated due to missing level (#19)

## 1.6.4 - 2023-01-23
- Added setting to control/disable the "shift+click" feature (#17)

## 1.6.1 - 2023-01-08
- Changed feat effects to signify time left to recharge after being expended (#15), thanks @xdy!
- [1.6.2] Fixed bug introduced after merging this new feature (#16)

## 1.6.0 - 2022-11-06
- Removed "hidden effects" feature - migrated to core "Unidentified" effect functionality

## 1.5.2 - 2022-10-29
- Fixed slight metagame leak of hidden effect existence (#13)

## 1.5.1 - 2022-10-24
- Added full localization support for French

## 1.5.0 - 2022-10-23
- Added keyboard shortcut and setting to make effects hidden
- Added basic localization support (french)

## 1.4.2 - 2022-10-22
- Added hidden effects feature (#8)

## 1.3.2 - 2022-10-21
- Improved the Shift+click code stability (credit to reonZ/Idle)

## 1.3.1 - 2022-10-05
- Fixed Ctrl+Shift+E error when striking (bad slug name) (#8)

## 1.3.0 - 2022-08-07
- Upgraded to v10 compatibility
- Fixed effects with "1 or more" in their duration (will be set as Unlimited)

## 1.2.1 - 2022-07-09
- Fixed shift-click reducing "locked" sub-conditions

## 1.2.0 - 2022-07-08
- Added ability to Shift+click to edit effects in the effects panel (#2)
- Added ability to Ctrl+Shift+E to create a new effect (#4)

## 1.1.0 - 2022-06-24
- Changed behavior of Shift key (held while activating) to be more generic and simple:  will open the effect's sheet.
- Made afflictions with a maximum duration use that duration for the effect.
- [1.1.1] Added lib-wrapper to dependencies, though it was already a dependency before

## 1.0.0 - 2022-06-16
- Created the module
