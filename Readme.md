# [pf2E Extempore Effects](https://foundryvtt.com/packages/pf2e-extempore-effects/)

![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/itamarcu/pf2e-extempore-effects?style=for-the-badge)
![GitHub Releases](https://img.shields.io/github/downloads/itamarcu/pf2e-extempore-effects/latest/total?style=for-the-badge)
![GitHub All Releases](https://img.shields.io/github/downloads/itamarcu/pf2e-extempore-effects/total?style=for-the-badge&label=Downloads+total)
![Latest Supported Foundry Version](https://img.shields.io/endpoint?url=https://foundryshields.com/version?url=https://github.com/itamarcu/pf2e-extempore-effects/raw/master/module.json)

FoundryVTT module for the PF2e system, which allows creating temporary Effects from chat messages, to easily mark tokens
as affected by a spell/action/item that doesn't normally have embedded effects

To install, browse for it in the module browser,
or [directly copy the manifest link for the latest release](https://github.com/itamarcu/pf2e-extempore-effects/releases/latest/download/module.json)
.

# Features

To use, select one or more tokens and then right-click on a message in the chat.  An option, "Extempore Effect", should
appear.  Clicking that option will grant a new Effect to all controlled tokens.

The Effect will have its name, description, level, traits, etc. match the message's item ("item" here being a spell,
an action, a feat, a weapon, etc.).  The duration will usually fit if possible (required some hardcoding and doesn't 
cover all bases).

The image will fit the item too, but not if it's a "default image" (like the default feat icon or
any of the simple 1/2/3-action icons).  To avoid having several Effects with the same image (and avoid the boring 
default images), this module will either use the image of the original item's token/actor, or will randomly pick a
simple colored image.

As a bonus feature, right-clicking actual Effect messages will display an "Apply Effect" option to just apply that same
effect to the controlled token.  This is just a quality-of-life feature.


![](metadata/ee_demo_1.gif)
