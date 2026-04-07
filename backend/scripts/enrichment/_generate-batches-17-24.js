#!/usr/bin/env node
'use strict'
// Generator — run once to emit batch files 17-24, then delete this file.
// node scripts/enrichment/_generate-batches-17-24.js

const fs = require('fs')
const path = require('path')

const BATCHES = {
  17: {
    label: 'GBC wave 1',
    games: [
      { gameId: '007-the-world-is-not-enough-game-boy-color', title: '007: The World is Not Enough', summary: "Vicarious Visions' GBC adaptation of the Bond film delivers top-down stealth and action missions across the film's locations, translating the spy franchise's gadget-and-infiltration structure to a compact handheld perspective." },
      { gameId: 'azure-dreams-game-boy-color', title: 'Azure Dreams', summary: "Konami's GBC port of the PS1 town-building roguelike follows Koh collecting monster eggs in an ever-changing tower, scaling the original's rogue dungeon and relationship-building systems into a portable format." },
      { gameId: 'blade-game-boy-color', title: 'Blade', summary: "Warthog's GBC action game adapts the Marvel vampire hunter Blade in an isometric beat-'em-up structure, following the half-vampire's blade-and-gun combat across a licensed movie tie-in to the 1998 Wesley Snipes film." },
      { gameId: 'blaster-master-enemy-below-game-boy-color', title: 'Blaster Master: Enemy Below', summary: "Sunsoft's GBC original follows the Blaster Master formula of tank combat and on-foot dungeon exploration in a fresh Color-exclusive adventure, revisiting the franchise's dual-mode gameplay on the handheld with enhanced color visuals." },
      { gameId: 'bomberman-max-game-boy-color', title: 'Bomberman Max', summary: "Hudson's GBC dual-release Bomberman follows a maze-bomb format with a Charabom monster companion system, letting players capture and level up creature allies in a handheld adventure framed by single-player puzzle stages and link cable battles." },
      { gameId: 'bomberman-quest-game-boy-color', title: 'Bomberman Quest', summary: "Hudson's GBC action RPG breaks from the franchise's arena bomb format to deliver a top-down RPG adventure where Bomberman traverses an island recovering parts from monster bosses in a structure closer to Zelda than the mainline series." },
      { gameId: 'buffy-the-vampire-slayer-game-boy-color', title: 'Buffy the Vampire Slayer', summary: "The Game Boy Color Buffy licensed game follows the Slayer through isometric action stages against vampires and demons, translating the WB series' supernatural combat into a portable format aimed at the show's younger fanbase." },
      { gameId: 'bust-a-move-millennium-game-boy-color', title: 'Bust-a-Move Millennium', summary: "Taito's GBC bubble-shooting puzzle game extends the arcade franchise to the Color hardware with new stage layouts and a two-player link cable mode, maintaining the bubble-match formula that made the series a handheld puzzle staple." },
      { gameId: 'cannon-fodder-game-boy-color', title: 'Cannon Fodder', summary: "Sensible Software's GBC port of the iconic PC squad shooter adapts the isometric troop-command and satirical tone of the original to the handheld, reducing squad size and map scale for the portable platform's technical constraints." },
      { gameId: 'carmageddon-ii-carpocalypse-now-game-boy-color', title: 'Carmageddon II: Carpocalypse Now', summary: "Titus Software's GBC vehicular carnage game compresses the controversial PC racing sequel's pedestrian-targeting premise into a top-down handheld format, offering a significantly toned-down interpretation of the original's shock content." },
      { gameId: 'batman-beyond-return-of-the-joker-game-boy-color', title: 'Batman Beyond: Return of the Joker', summary: "The GBC adaptation of the animated Batman Beyond film follows Terry McGinnis through side-scrolling combat in a futuristic Gotham, offering licensed handheld action tied to the animated film's Joker confrontation narrative." },
      { gameId: 'batman-chaos-in-gotham-game-boy-color', title: 'Batman: Chaos in Gotham', summary: "Kemco's GBC Batman action game features both Batman and Batgirl as selectable characters across side-scrolling stages battling Arkham escapees, delivering a licensed handheld adventure set in the Batman Beyond animated universe." },
      { gameId: 'aliens-thanatos-encounter-game-boy-color', title: 'Aliens: Thanatos Encounter', summary: "Crawfish Interactive's GBC top-down shooter places marines through xenomorph-infested corridors on a derelict spaceship, offering four playable characters and a co-op link cable mode in a budget-tier licensed handheld adaptation." },
      { gameId: 'asteroids-game-boy-color', title: 'Asteroids', summary: "Activision's GBC update of the 1979 Atari arcade classic adds new game modes and power-ups to the original's vector-geometry space shooting formula, presenting the foundational shoot-'em-up in a small-screen handheld format with Color enhancements." },
      { gameId: 'castlevania-ii-belmont-s-revenge-game-boy-color', title: "Castlevania II: Belmont's Revenge", summary: "Konami's GBC port of the Game Boy Castlevania sequel brings Christopher Belmont's four-castle vampire hunt to the Color platform, presenting the original's superior subweapon mechanics and multi-route structure with enhanced color visuals." },
      { gameId: 'a-bug-s-life-game-boy-color', title: "A Bug's Life", summary: "The GBC adaptation of the Disney-Pixar film follows Flik through insect-scale levels in a side-scrolling platformer, translating the animated film's colony narrative into a compact portable structure for the Color handheld." },
      { gameId: 'animorphs-game-boy-color', title: 'Animorphs', summary: "Ubisoft's GBC game adapts the K.A. Applegate book series about teens who can morph into animals, using each transformation's abilities across puzzle-platformer stages in a licensed adventure aimed at the books' young adult audience." },
      { gameId: 'alice-in-wonderland-game-boy-color', title: 'Alice in Wonderland', summary: "The GBC Alice adaptation follows the Disney film's version of the story through Wonderland environments in a side-scrolling format, using Alice's size-changing mechanics as a puzzle element tied to the story's iconic imagery." },
      { gameId: 'airforce-delta-game-boy-color', title: 'Airforce Delta', summary: "Konami's GBC aerial combat game delivers a scaled-down version of the console flight franchise's mission-based dogfighting, offering a portable top-down air combat experience with a small fighter roster across a campaign structure." },
      { gameId: 'atlantis-the-lost-empire-game-boy-color', title: 'Atlantis: The Lost Empire', summary: "The GBC licensed game adapts the Disney animated film's underwater exploration narrative into an action-adventure structure, following Milo Thatch through the titular lost civilization with puzzle and combat elements." },
      { gameId: 'austin-powers-welcome-to-my-underground-lair-game-boy-color', title: "Austin Powers: Welcome to My Underground Lair!", summary: "Black Ops Entertainment's GBC game places players in the role of Dr. Evil managing a villain organization through strategy minigames, inverting the usual action-hero licensed game structure in a comedy simulation tied to the film franchise." },
      { gameId: 'armorines-project-s-w-a-r-m-game-boy-color', title: 'Armorines: Project S.W.A.R.M.', summary: "Valiant Comics' GBC adaptation of the alien-bug invasion license delivers top-down shooter action through military environments, porting the franchise's insect-combat premise to the Color platform in a budget-tier handheld format." },
      { gameId: 'army-men-sarge-s-heroes-2-game-boy-color', title: "Army Men: Sarge's Heroes 2", summary: "The GBC entry in 3DO's plastic soldier franchise delivers top-down action across household-scale environments, following Sarge through mission-based combat as a miniaturized portable entry in the Army Men series." },
      { gameId: 'buzz-lightyear-of-star-command-game-boy-color', title: 'Buzz Lightyear of Star Command', summary: "The GBC licensed game adapts the Disney animated series about the space ranger through side-scrolling action stages, using Buzz's laser blaster and jetpack in a compact portable format tied to the animated TV show's missions." },
      { gameId: 'asterix-search-for-dogmatix-game-boy-color', title: 'Asterix: Search for Dogmatix', summary: "The GBC Asterix puzzle-adventure sends the Gaulish warrior through environments searching for Obelix's dog Dogmatix, using item collection and obstacle clearing in a licensed portable format suited to the Color hardware's capabilities." },
      { gameId: 'bass-masters-classic-game-boy-color', title: 'Bass Masters Classic', summary: "The GBC fishing simulation adapts the bass tournament format of the console series to the handheld, offering simplified casting mechanics and lure management across seasonal lake conditions in a portable sportfishing experience." },
      { gameId: 'battletanx-game-boy-color', title: 'BattleTanx', summary: "The GBC port of 3DO's post-apocalyptic tank combat game adapts the street-level urban armored vehicle combat to a top-down handheld perspective, scaling the console's story mode and multiplayer structure for the Color platform." },
      { gameId: 'buffy-the-vampire-slayer-game-boy-color', title: 'Buffy the Vampire Slayer', summary: "The GBC Buffy action game sends the Slayer through isometric vampire-hunting stages, using the series' supernatural combat in a portable licensed format targeting the TV show's fanbase with a mission structure drawn from the show's early seasons." },
      { gameId: 'bugs-bunny-in-crazy-castle-4-game-boy-color', title: 'Bugs Bunny in Crazy Castle 4', summary: "Kemco's GBC continuation of the Crazy Castle puzzle series follows Bugs Bunny through maze stages collecting items while avoiding enemies, maintaining the franchise's simple but addictive collect-and-avoid structure in Color handheld form." },
      { gameId: 'bugs-bunny-lola-bunny-operation-carrot-patch-game-boy-color', title: 'Bugs Bunny & Lola Bunny: Operation Carrot Patch', summary: "The GBC action game pairs Bugs and Lola Bunny through side-scrolling missions defending their garden from Elmer Fudd and Yosemite Sam, offering two-character play as a licensed handheld entry in the Looney Tunes portable game series." },
    ],
  },
  18: {
    label: 'Game Boy wave 2',
    games: [
      { gameId: 'adventure-island-ii-game-boy', title: 'Adventure Island II', summary: "Hudson's Game Boy sequel follows Master Higgins through a new island set with additional dinosaur companions and improved platformer mechanics, carrying forward the food-depleting health system and rapid-pace stage design of the original portable entry." },
      { gameId: 'alfred-chicken-game-boy', title: 'Alfred Chicken', summary: "Mindscape's Game Boy platformer follows a chicken hero through stages clearing balloons and enemies with his pecking beak, offering a compact British-developed handheld game with cheerful platformer mechanics and a distinctive avian protagonist." },
      { gameId: 'asterix-game-boy', title: 'Asterix', summary: "Infogrames' Game Boy adaptation follows the Gaulish warrior through side-scrolling combat stages against Roman legions, compressing the licensed platformer format of the console Asterix games into a monochrome handheld structure." },
      { gameId: 'battle-city-game-boy', title: 'Battle City', summary: "Namco's Game Boy port of the 1985 Famicom/NES tank arcade game preserves the top-down base-defense shooting formula, placing a tank through waves of enemy armor in a single-screen combat structure well-suited to handheld play." },
      { gameId: 'beetlejuice-game-boy', title: 'Beetlejuice', summary: "LJN's Game Boy platformer adapts Tim Burton's eccentric ghost character through side-scrolling stages using the bio-exorcist's supernatural tricks, targeting the film and animated series' audience with a licensed compact handheld adventure." },
      { gameId: 'bill-ted-s-excellent-game-boy-adventure-a-bogus-journey-game-boy', title: "Bill & Ted's Excellent Game Boy Adventure: A Bogus Journey!", summary: "LJN's Game Boy game based on the 1991 film sequel sends Bill and Ted through time-traveling side-scrolling stages collecting items, adapting the comedy duo's phone-booth adventures to a portable licensed format." },
      { gameId: 'boxxle-game-boy', title: 'Boxxle', summary: "Pony Canyon's Game Boy port of the classic Sokoban warehouse puzzle game tasks players with pushing boxes onto marked targets across progressively complex floor layouts, delivering the definitive portable version of the foundational push-puzzle format." },
      { gameId: 'bram-stoker-s-dracula-game-boy', title: "Bram Stoker's Dracula", summary: "Sony Imagesoft's Game Boy adaptation of the 1992 Coppola film delivers side-scrolling combat against vampires through castle environments, condensing the console versions' action structure into a monochrome handheld format tied to the prestige horror film." },
      { gameId: 'catrap-game-boy', title: 'Catrap', summary: "Asmik's Game Boy puzzle game is a port of the 1985 MSX game Pitman, featuring a boy and girl who traverse grid stages by pushing enemies into corners and can rewind any number of moves — an early rewind mechanic preceding its modern revival." },
      { gameId: 'cave-noire-game-boy', title: 'Cave Noire', summary: "Konami's Japan-only Game Boy roguelike sends an adventurer through procedurally generated dungeons collecting treasures, notable as a 1991 handheld roguelike that predates the genre's mainstream visibility by more than a decade." },
      { gameId: 'centipede-game-boy', title: 'Centipede', summary: "Accolade's Game Boy adaptation of the Atari arcade classic brings the mushroom-filled shooter to the handheld, condensing the segmented bug descent and shooter mechanics of the 1980 original into a compact portable format." },
      { gameId: 'choplifter-ii-game-boy', title: 'Choplifter II', summary: "Broderbund's Game Boy helicopter rescue game continues the hostage-retrieval mission structure of the original, tasking the pilot with navigating side-scrolling conflict zones to extract trapped civilians under fire." },
      { gameId: 'cliffhanger-game-boy', title: 'Cliffhanger', summary: "Ocean's Game Boy action game adapts the 1993 Sylvester Stallone mountain-rescue thriller into a side-scrolling format following Gabe Walker through snowy alpine environments against terrorists, as a condensed portable tie-in to the action film." },
      { gameId: 'cosmo-tank-game-boy', title: 'Cosmo Tank', summary: "Atlus' Game Boy RPG hybrid follows a pilot defending alien planets in a tank, blending overhead shooter stages with turn-based RPG battles in a genre combination unusual for the hardware that foreshadowed later portable RPG-shooter hybrids." },
      { gameId: 'daedalian-opus-game-boy', title: 'Daedalian Opus', summary: "Vic Tokai's Game Boy puzzle game tasks players with fitting geometric pieces into outlined frames across increasingly complex layouts, a polished shape-fitting puzzle that stands among the original Game Boy library's most accomplished pure puzzle designs." },
      { gameId: 'daffy-duck-game-boy', title: 'Daffy Duck', summary: "Ocean's Game Boy platformer follows Daffy Duck through side-scrolling stages using the Looney Tunes character's slapstick sensibility, adapting the Warner Bros. cartoon duck in a licensed compact handheld adventure." },
      { gameId: 'darkman-game-boy', title: 'Darkman', summary: "Ocean's Game Boy adaptation of Sam Raimi's 1990 superhero film sends the disfigured vigilante through side-scrolling stages against criminal organizations, compressing the film's pulp action narrative into a monochrome handheld platformer." },
      { gameId: 'days-of-thunder-game-boy', title: 'Days of Thunder', summary: "Mindscape's Game Boy racing game adapts the 1990 Tom Cruise NASCAR film into a top-down oval circuit racer, translating the stock car racing premise of the film into a compact handheld format with basic race management." },
      { gameId: 'deadeus-game-boy', title: 'Deadeus', summary: "IZMA's 2019 Game Boy homebrew horror RPG gives the player seven days to prevent an apocalyptic nightmare vision, offering multiple branching endings and an oppressive atmosphere that demonstrates the original hardware's capacity for genuinely unsettling narrative." },
      { gameId: 'dick-tracy-game-boy', title: 'Dick Tracy', summary: "Bandai's Game Boy adaptation of the 1990 Warren Beatty film sends the square-jawed detective through side-scrolling stages against gangsters, condensing the film's comic-strip aesthetic into a monochrome handheld action format." },
      { gameId: 'dino-breeder-game-boy', title: 'Dino Breeder', summary: "Bandai's Japan-only Game Boy monster-raising game tasks players with hatching and training dinosaurs through feeding and battle sequences, serving as a precursor to the Tamagotchi-and-Pokémon era of creature-nurturing portable games." },
      { gameId: 'battle-unit-zeoth-game-boy', title: 'Battle Unit Zeoth', summary: "Jaleco's Game Boy horizontal shooter places a spacecraft through alien-infested stages with power-up collecting and boss confrontations, offering an early example of the genre's compact portable format on the original Game Boy hardware." },
      { gameId: 'baseball-game-boy', title: 'Baseball', summary: "Nintendo's Game Boy launch baseball title delivers a stripped-down version of the NES Baseball with simplified controls and a two-team roster, serving as the first handheld baseball game and a demonstration of the platform's sports game potential at launch." },
      { gameId: 'aerostar-game-boy', title: 'Aerostar', summary: "Vic Tokai's Game Boy vertical shooter sends a spacecraft through scrolling asteroid and enemy waves, delivering a compact shoot-'em-up with a power-up accumulation system across a short campaign suited to handheld session play." },
      { gameId: 'atomic-punk-game-boy', title: 'Atomic Punk', summary: "Hudson's Game Boy Bomberman variant — released as Atomic Punk in North America — maintains the maze-bomb gameplay of the franchise but replaces Bomberman's name and design, offering the core arena bomb formula in a compact early handheld format." },
      { gameId: 'cool-world-game-boy', title: 'Cool World', summary: "Ocean's Game Boy adaptation of Ralph Bakshi's 1992 hybrid animated film follows detective Frank Harris through cartoon-world environments, translating the film's crossover premise into a side-scrolling action format for the monochrome handheld." },
      { gameId: 'block-hole-game-boy', title: 'Block Hole', summary: "Kaneko's Game Boy puzzle-shooter hybrid tasks players with using a robot to clear blocks by shooting matches while avoiding hazards, combining a fixed-shooter perspective with a falling-block puzzle structure in a compact early handheld release." },
      { gameId: 'boxing-game-boy', title: 'Boxing', summary: "Activision's Game Boy boxing game puts two fighters through a side-view punch exchange with stamina management, delivering a simplified version of the sport's competitive fundamentals in a compact handheld format for the original Game Boy." },
      { gameId: 'bubsy-2-game-boy', title: 'Bubsy 2', summary: "Accolade's Game Boy port compresses the second 16-bit Bubsy platformer's stage design into the monochrome handheld format, following the wisecracking bobcat through side-scrolling environments as a portable entry in the controversial 90s mascot franchise." },
      { gameId: 'black-bass-lure-fishing-game-boy', title: 'Black Bass: Lure Fishing', summary: "HOT-B's Game Boy fishing simulation adapts the console Black Bass series to the handheld with simplified lure selection and casting mechanics across lake environments, targeting the sportfishing audience with a compact portable fishing experience." },
    ],
  },
  19: {
    label: 'NES wave 1',
    games: [
      { gameId: 'abadox-nes', title: 'Abadox', summary: "Natsume's NES horizontal shooter sends a soldier inside a massive alien organism to rescue a swallowed princess, delivering a visceral biological horror aesthetic through densely patterned enemy formations and a grueling difficulty that defines the game's cult appeal." },
      { gameId: 'adventure-island-nes', title: 'Adventure Island', summary: "Hudson's NES adaptation of Wonder Boy follows Master Higgins through tropical stages collecting fruit to sustain a health-draining timer, establishing the food-as-health mechanic that would define the franchise across multiple sequels." },
      { gameId: 'adventure-island-ii-nes', title: 'Adventure Island II', summary: "Hudson's NES sequel improves on the original with rideable dinosaur companions and a selectable stage structure, expanding the fruit-collecting platformer loop into a more varied tropical adventure across eight distinct island worlds." },
      { gameId: 'adventure-island-3-nes', title: 'Adventure Island 3', summary: "Hudson's third NES Adventure Island continues the dinosaur-companion formula with new prehistoric creature types and stage mechanics, pushing the series' platformer formula to its most refined 8-bit expression across a prehistoric setting." },
      { gameId: 'adventures-of-lolo-nes', title: 'Adventures of Lolo', summary: "HAL Laboratory's NES puzzle game follows the round blue Lolo through single-screen rooms using heart framers to freeze enemies and collect hearts, establishing a methodical enemy-manipulation puzzle formula that spawned two NES sequels." },
      { gameId: 'adventures-of-lolo-2-nes', title: 'Adventures of Lolo 2', summary: "HAL Laboratory's NES sequel expands the enemy-freezing heart puzzle rooms of the original with new enemy types and room configurations, maintaining the precise single-screen puzzle structure that made the first game a cult favorite." },
      { gameId: 'adventures-of-lolo-3-nes', title: 'Adventures of Lolo 3', summary: "HAL Laboratory's final NES Lolo adds Lala as a second playable character to the established single-screen puzzle formula, offering the most content-rich entry in the trilogy with the largest room count and deepest mechanical variety." },
      { gameId: 'air-fortress-nes', title: 'Air Fortress', summary: "HAL Laboratory's NES hybrid action game alternates between a side-scrolling space shooter approach phase and a first-person interior infiltration phase where Hal Bailman plants bombs inside enemy fortresses before escaping before detonation." },
      { gameId: 'airwolf-nes', title: 'Airwolf', summary: "Kyugo's NES adaptation of the CBS helicopter TV series delivers multidirectional scrolling aerial combat through cave systems and open terrain, converting the show's high-tech supercopter missions into a compact 8-bit shooter." },
      { gameId: 'alien-3-nes', title: 'Alien 3', summary: "Probe Software's NES port of the film-based game scales the prison-planet xenomorph hunt to the 8-bit platform, adapting the rescue mission structure and side-scrolling combat of the console versions to the NES hardware's constraints." },
      { gameId: 'alien-syndrome-nes', title: 'Alien Syndrome', summary: "Tengen's NES port of the Sega arcade game follows soldiers through maze-like spacecraft rescuing hostages before a timer expires, delivering the top-down run-and-gun cooperative format of the original coin-op in a home console adaptation." },
      { gameId: 'alpha-mission-nes', title: 'Alpha Mission', summary: "SNK's NES vertical shooter is an early entry in the company's shooter catalogue, featuring surface and aerial weapon layers that the player must separately maintain while navigating densely populated enemy formations." },
      { gameId: 'altered-beast-nes', title: 'Altered Beast', summary: "Sega's NES port of the 1988 arcade beat-'em-up follows resurrected warriors collecting power orbs to transform into mythological creatures, scaling the coin-op's two-player brawling and transformation spectacle to the 8-bit Nintendo platform." },
      { gameId: 'amagon-nes', title: 'Amagon', summary: "Aicom's NES action platformer follows a marine stranded on a monster-filled island who can transform into the giant Megagon by expending ammo, introducing a risk-reward power conversion mechanic into an otherwise conventional side-scrolling format." },
      { gameId: 'american-gladiators-nes', title: 'American Gladiators', summary: "Gametek's NES adaptation of the syndicated TV competition show compiles the show's main events — joust, assault, powerball, the wall, and the eliminator — into a multi-event athletic competition game with the program's physical challenge format." },
      { gameId: 'anticipation-nes', title: 'Anticipation', summary: "Rare's NES board game adaptation is the first Nintendo-published Rare title, featuring a Pictionary-style drawing guessing game across a color-coded board where players race to identify illustrations drawn by an onscreen cursor." },
      { gameId: 'antarctic-adventure-nes', title: 'Antarctic Adventure', summary: "Konami's NES port of the MSX and Famicom penguin racing game follows Penta the penguin through an obstacle-filled Antarctic sprint between bases, serving as one of the earliest endless-runner-style games in a simple but addictive format." },
      { gameId: 'arch-rivals-nes', title: 'Arch Rivals', summary: "Midway's NES port of the 1989 arcade basketball game offers two-on-two streetball without fouls, encouraging physical play and dirty tactics in an early sports title that anticipated the Barkley and NBA Jam games of the following decade." },
      { gameId: 'adventures-in-the-magic-kingdom-nes', title: 'Adventures in the Magic Kingdom', summary: "Capcom's NES Disney theme park game tasks players with collecting six silver keys from mini-games representing Disneyland attractions to unlock the Magic Kingdom's gate, blending trivia and action challenges in a unique licensed format." },
      { gameId: 'adventures-of-dino-riki-nes', title: 'Adventures of Dino Riki', summary: "Hudson's NES vertical shooter follows a prehistoric warrior through dinosaur-filled jungle and cave stages, delivering a top-down run-and-gun format with stone-age weapon upgrades across a compact four-world campaign." },
      { gameId: 'airwolf-nes', title: 'Airwolf', summary: "The NES Airwolf game follows the armed superhelicopter through multidirectional scrolling cavern and surface missions, delivering a compact top-down aerial combat experience based on the 1980s CBS TV series." },
      { gameId: 'al-unser-jr-s-turbo-racing-nes', title: "Al Unser Jr.'s Turbo Racing", summary: "Data East's NES IndyCar racing game carries the licensed Al Unser Jr. brand across oval circuits with drafting and pit strategy, offering a modest simulation of the CART racing series in an isometric perspective on 8-bit hardware." },
      { gameId: 'alfred-chicken-nes', title: 'Alfred Chicken', summary: "Mindscape's NES port of the Amiga and Game Boy platformer brings the beak-attacking chicken through a compact set of stages, delivering a late-era NES licensed platformer with simple but functional mechanics on a platform already winding down." },
      { gameId: 'argus-nes', title: 'Argus', summary: "Jaleco's NES vertical shooter follows a spacecraft through alien territory collecting weapon pods that orbit the player ship, featuring a rotating satellite system that requires spatial awareness to use effectively in dense enemy formations." },
      { gameId: 'air-fortress-nes', title: 'Air Fortress', summary: "HAL Laboratory's NES shooter-infiltration hybrid alternates a horizontal shooter approach with a first-person interior phase inside enemy fortresses, building a dual-mode structure that challenges both quick reflexes and navigation under timer pressure." },
      { gameId: 'abadox-nes', title: 'Abadox', summary: "Natsume's NES horizontal and vertical shooter challenges players inside a living alien planet, combining biological horror enemy design with punishing difficulty and dense bullet patterns that give the game an enduring cult reputation." },
      { gameId: 'all-pro-basketball-nes', title: 'All-Pro Basketball', summary: "VARIE's NES basketball simulation offers a statistical management layer alongside on-court five-on-five action, providing a more simulation-minded alternative to the era's arcade basketball games in a late NES library entry." },
      { gameId: 'airwolf-nes', title: 'Airwolf', summary: "KID's NES Airwolf delivers multidirectional scrolling helicopter missions rescuing hostages from enemy bases, translating the TV show's high-tech rescue premise into a top-down action format with weapon and fuel management." },
      { gameId: 'akira-nes', title: 'Akira', summary: "Taito's Japan-only NES adaptation of Katsuhiro Otomo's landmark 1988 anime film compresses the Neo-Tokyo dystopia into a hybrid action-puzzle game, allowing players to guide Kaneda and Tetsuo through scenarios drawn from the film's narrative." },
      { gameId: 'amagon-nes', title: 'Amagon', summary: "Amagon's NES side-scroller distinguishes itself with a transformation mechanic where collecting enough ammo converts the marine into the giant invincible Megagon, rewarding resource discipline with a spectacular power spike that defines its risk-reward identity." },
    ],
  },
  20: {
    label: 'PlayStation wave 5',
    games: [
      { gameId: 'contras-game-boy-advance', title: 'Contra Advance: The Alien Wars EX', summary: "Konami's GBA port of Contra III updates the SNES run-and-gun classic for the handheld, removing the overhead rotation stages but preserving the intense two-player side-scrolling alien combat and the franchise's demanding action heritage." },
      { gameId: 'coolboarders-2-playstation', title: "Cool Boarders 2", summary: "UEP Systems' PS1 snowboarding sequel expands the original's slope-racing and trick system with new boards, mountains, and competition modes, becoming one of the most commercially successful snowboarding games of the PlayStation era." },
      { gameId: 'coolboarders-3-playstation', title: "Cool Boarders 3", summary: "UEP Systems' PS1 third entry in the snowboarding series refines the trick system and adds new challenge events to the established slope-racing formula, continuing the franchise's commercial momentum with improved presentation." },
      { gameId: 'coolboarders-4-playstation', title: "Cool Boarders 4", summary: "UEP Systems' fourth PS1 snowboarding entry expands the series' mountain roster and trick vocabulary to close the franchise's PlayStation run, offering the most feature-rich iteration of the slope-racing and freestyle format." },
      { gameId: 'contras-game-boy', title: 'Contra', summary: "Konami's Game Boy Contra adapts the two-player NES run-and-gun classic into a single-player handheld format, compressing the alien-combat stage structure and Konami Code tradition of the franchise for portable play." },
      { gameId: 'crash-bandicoot-playstation', title: 'Crash Bandicoot', summary: "Naughty Dog's PS1 platformer launched Sony's answer to Mario with a spin-attacking marsupial across corridor-structured 3D stages, combining tight linear design with humorous character animation in a mascot game that sold the PlayStation brand." },
      { gameId: 'crash-bandicoot-2-cortex-strikes-back-playstation', title: 'Crash Bandicoot 2: Cortex Strikes Back', summary: "Naughty Dog's PS1 sequel improves on the original with a hub world structure, new moves, and more varied stage types, refining the corridor platformer formula that made the first game a landmark and deepening its mechanical breadth." },
      { gameId: 'crash-bandicoot-warped-playstation', title: 'Crash Bandicoot: Warped', summary: "Naughty Dog's PS1 trilogy closer adds motorcycle racing, biplane shooting, and underwater stages to the franchise, delivering the most mechanically varied Crash entry and widely regarded as the peak of the original Naughty Dog trilogy." },
      { gameId: 'crash-team-racing-playstation', title: 'Crash Team Racing', summary: "Naughty Dog's PS1 kart racer puts the Crash Bandicoot cast through weapon-equipped circuit racing with a power-slide boost mechanic, widely considered one of the best kart racers of its era and a genuine rival to Mario Kart 64." },
      { gameId: 'castlevania-symphony-of-the-night-playstation', title: 'Castlevania: Symphony of the Night', summary: "Konami's PS1 masterwork inverts the Castlevania formula into open RPG castle exploration with Alucard collecting gear and leveling stats, defining the Metroidvania template and serving as one of the most celebrated games of the 32-bit era." },
      { gameId: 'civilization-ii-playstation', title: 'Civilization II', summary: "MPS Labs' PS1 port of the landmark PC strategy sequel adds new government types, diplomacy options, and wonders to Sid Meier's civilization-building framework, translating the deep turn-based empire management to the console with interface adaptations." },
      { gameId: 'colony-wars-vengeance-playstation', title: 'Colony Wars: Vengeance', summary: "Psygnosis's PS1 space combat sequel continues the rebellion narrative with a new pilot in a branching mission campaign, adding new ship classes and a deeper story structure to the cockpit dogfighting established in the original Colony Wars." },
      { gameId: 'crypt-killer-playstation', title: 'Crypt Killer', summary: "Konami's PS1 port of the light-gun arcade shooter sends players through monster-filled temples and crypts using the GunCon peripheral, delivering on-rails gallery shooting across Egyptian, jungle, and gothic horror environments." },
      { gameId: 'countdown-vampires-playstation', title: 'Countdown Vampires', summary: "Bandai's PS1 survival horror follows a security officer in a casino turned into a vampire infestation zone, delivering Resident Evil-influenced fixed-camera survival action with a unique mechanic that allows vampires to be cured rather than only destroyed." },
      { gameId: 'clock-tower-playstation', title: 'Clock Tower', summary: "Human Entertainment's PS1 survival horror point-and-click adventure follows Jennifer Simpson being stalked by the scissor-wielding Scissorman, using a helpless protagonist and pursuit-avoidance tension that defined Japanese chase horror before Resident Evil." },
      { gameId: 'clock-tower-2-the-struggle-within-playstation', title: 'Clock Tower II: The Struggle Within', summary: "Human Entertainment's PS1 sequel shifts the Clock Tower formula to a new protagonist with a multiple personality disorder, expanding the chase-and-hide survival horror with branching narrative paths and multiple endings across a new killer threat." },
      { gameId: 'chronicles-of-the-sword-playstation', title: 'Chronicles of the Sword', summary: "Mindscape's PS1 FMV strategy game tells an Arthurian legend through a combination of pre-rendered cutscenes and card-based battle sequences, blending cinematic storytelling with light strategy in a narrative-driven CD-ROM format." },
      { gameId: 'bushido-blade-playstation', title: 'Bushido Blade', summary: "Light Weight's PS1 weapon fighter eliminates health bars for a limb-damage injury system where a single clean strike ends a match, creating a deliberate pacing and tactical depth unlike any competitive fighting game of its era." },
      { gameId: 'cardinal-syn-playstation', title: 'Cardinal Syn', summary: "989 Studios' PS1 3D fighting game places warriors in an open arena with free movement and a capture-the-soul strategic layer, attempting to differentiate its combat from conventional 2D fighters by incorporating territorial control between rounds." },
      { gameId: 'carnage-heart-playstation', title: 'Carnage Heart', summary: "Artdink's Japan-only PS1 mech strategy game has players programming autonomous OKE robots through a visual flowchart AI editor rather than direct control, creating battles between pre-programmed machines in a unique strategic simulation genre." },
    ],
  },
  21: {
    label: 'N64 wave 4 + NDS wave 2',
    games: [
      { gameId: 'extreme-g-nintendo-64', title: 'Extreme-G', summary: "Acclaim's N64 anti-gravity racer delivers high-speed futuristic motorcycle combat racing with boost management and weapon pickups at velocities that blur track geometry, offering an adrenaline-focused alternative to F-Zero 64's purer racing." },
      { gameId: 'fighter-destiny-2-nintendo-64', title: 'Fighter Destiny 2', summary: "Ocean's N64 fighting game sequel expands the point-scoring combat system of the original, rewarding specific knockdown types with score increments rather than life depletion in a mechanically distinct approach to competitive fighting game structure." },
      { gameId: 'forsaken-64-nintendo-64', title: 'Forsaken 64', summary: "Iguana Entertainment's N64 six-degrees-of-freedom shooter places players on hoverbikes through post-apocalyptic underground environments, competing against AI enemies in corridor-tunnel combat influenced by the Descent PC series." },
      { gameId: 'f-zero-x-nintendo-64', title: 'F-Zero X', summary: "Nintendo's N64 anti-gravity racer sacrifices graphical detail for a locked 60fps with 30 simultaneous racers, delivering the purest expression of the franchise's high-speed circuit format and adding a Death Race mode and a randomized course generator." },
      { gameId: 'goemon-s-great-adventure-nintendo-64', title: "Goemon's Great Adventure", summary: "Konami's N64 sequel returns Goemon to a 2D side-scrolling format after the previous game's 3D adventure, featuring two-player co-op through samurai-era Japan with the franchise's signature surreal humor and robot giant battle sequences." },
      { gameId: 'golden-eye-007-nintendo-64', title: 'GoldenEye 007', summary: "Rare's N64 James Bond FPS established the template for console first-person shooters with its mission-objective structure, split-screen multiplayer, and contextual character animation, becoming one of the most influential games ever made." },
      { gameId: 'hexen-nintendo-64', title: 'Hexen', summary: "Software Creations's N64 port of Raven's dark fantasy FPS delivers three character classes through hub-connected maze environments with key-hunt progression, offering a grimmer and more complex alternative to Doom 64 in the platform's FPS library." },
      { gameId: 'hybrid-heaven-nintendo-64', title: 'Hybrid Heaven', summary: "Konami's N64 action RPG blends real-time exploration with turn-based wrestling-style limb-targeting combat, placing an agent inside a secret underground Manhattan facility in a genre hybrid that earned a cult following for its mechanical ambition." },
      { gameId: 'iggy-s-reckin-balls-nintendo-64', title: "Iggy's Reckin' Balls", summary: "Iguana Entertainment's N64 competitive racer uses a grappling hook to swing through vertical tube tracks, creating a traversal mechanic distinct from the era's conventional racers that emphasized momentum and route-finding over raw speed." },
      { gameId: 'indy-racing-2000-nintendo-64', title: 'Indy Racing 2000', summary: "Paradigm Entertainment's N64 IndyCar sim features licensed IRL oval circuits with realistic drafting physics and strategic tire management, targeting the dedicated motorsport simulation audience that the platform's more arcade-oriented racers didn't serve." },
      { gameId: 'jet-force-gemini-nintendo-64', title: 'Jet Force Gemini', summary: "Rare's N64 third-person shooter follows three heroes across the galaxy battling an insectoid army in missions emphasizing heavy firepower, twin-stick-like targeting, and the franchise's characteristic Rare visual polish and dark-edged humor." },
      { gameId: 'killer-instinct-gold-nintendo-64', title: 'Killer Instinct Gold', summary: "Rare's N64 port of the second arcade Killer Instinct entry delivers the franchise's ultra-combo chain system and eclectic sci-fi fighter roster to the home console, establishing the N64 as a destination for the fighting game community." },
      { gameId: 'kirby-64-the-crystal-shards-nintendo-64', title: 'Kirby 64: The Crystal Shards', summary: "HAL Laboratory's N64 platformer introduces a copy-combine mechanic where two swallowed powers fuse into unique hybrid abilities, delivering a gentler platformer experience across five planets in Kirby's only original N64 console appearance." },
      { gameId: 'majora-s-mask-nintendo-64', title: "The Legend of Zelda: Majora's Mask", summary: "Nintendo's N64 Zelda sequel constrains its entire world to a three-day loop reset with Ocarina of Time's engine, building a deeply melancholy time-manipulation adventure around recurring character schedules and the impending fall of the moon." },
      { gameId: 'mario-party-nintendo-64', title: 'Mario Party', summary: "Hudson Soft's N64 party game established the board-game-plus-minigame formula with 50 unique minigames across six boards, becoming the definitive multiplayer experience on the platform and spawning one of Nintendo's most enduring party franchises." },
      { gameId: 'mario-party-2-nintendo-64', title: 'Mario Party 2', summary: "Hudson Soft's N64 sequel expands the party formula with themed board settings that give each map a distinct costume and identity, refining the minigame variety and addressing criticisms of the original's more luck-dependent board design." },
      { gameId: 'mario-party-3-nintendo-64', title: 'Mario Party 3', summary: "Hudson Soft's third and final N64 Mario Party adds a duel map mode and item system to the established board-game formula, delivering the most mechanically complex entry in the original trilogy and the platform's largest minigame collection." },
      { gameId: 'castlevania-nintendo-64', title: 'Castlevania (Nintendo 64)', summary: "Konami's N64 experiment translates the Castlevania franchise into full 3D for the first time, following Reinhardt Schneider and Carrie Fernandez through gothic environments in a transition that divided fans between its atmospheric ambition and unwieldy camera." },
      { gameId: 'castlevania-legacy-of-darkness-nintendo-64', title: 'Castlevania: Legacy of Darkness', summary: "Konami's N64 Castlevania expansion adds Cornell the man-beast as a new protagonist with additional chapters and refines the original game's mechanics, serving as both a prequel and an enhanced version of the controversial 3D series experiment." },
      { gameId: 'paper-mario-nintendo-64', title: 'Paper Mario', summary: "Intelligent Systems' N64 RPG revisits the Super Mario RPG format with a flat paper aesthetic, introducing partners and a badge-based ability system across a turn-based adventure that launched one of Nintendo's most creatively inventive RPG franchises." },
    ],
  },
  22: {
    label: 'GBA wave 2',
    games: [
      { gameId: 'ace-combat-advance-game-boy-advance', title: 'Ace Combat Advance', summary: "Ubisoft's GBA entry in the Ace Combat franchise delivers top-down aerial mission combat across a small campaign, scaling the series' mission-based dogfighting to the handheld in a format diverging significantly from the console franchise's cockpit perspective." },
      { gameId: 'aggressive-inline-game-boy-advance', title: 'Aggressive Inline', summary: "Z-Axis's GBA port of the console inline skating game adapts the trick-combo rail-grinding formula to the handheld, compressing the urban skating sandbox of the console versions into a mission-based portable format." },
      { gameId: 'asterix-obelix-xxl-game-boy-advance', title: 'Asterix & Obelix XXL', summary: "The GBA Asterix XXL follows the Gaulish warriors through side-scrolling beat-'em-up combat against Roman camps, adapting the 3D console game's licensed franchise combat to a 2D handheld structure suited to the GBA's capabilities." },
      { gameId: 'asterix-obelix-bash-them-all-game-boy-advance', title: 'Asterix & Obelix: Bash Them All!', summary: "Ubisoft's GBA licensed brawler sends Asterix and Obelix through European regions bashing Romans across side-scrolling stages, delivering straightforward two-character beat-'em-up action in a portable entry in the long-running Gaulish franchise." },
      { gameId: 'atlantis-the-lost-empire-game-boy-advance', title: 'Atlantis: The Lost Empire', summary: "The GBA game based on Disney's 2001 animated film follows Milo Thatch through the underwater civilization in a side-scrolling action-adventure, adapting the film's archaeological exploration narrative to a portable licensed format." },
      { gameId: 'avatar-the-last-airbender-the-burning-earth-game-boy-advance', title: 'Avatar: The Last Airbender – The Burning Earth', summary: "THQ's GBA sequel to the first Avatar game continues Aang's journey in a side-scrolling action format, expanding the bending combat system with additional elemental disciplines across stages drawn from the animated series' second season." },
      { gameId: 'balloon-fight-game-boy-advance', title: 'Balloon Fight', summary: "Nintendo's GBA port of the 1984 NES launch title brings the balloon-jousting aerial combat to the handheld with a faithful recreation of the original game's mechanics and the addictive endless Balloon Trip mode." },
      { gameId: 'alex-rider-stormbreaker-game-boy-advance', title: 'Alex Rider: Stormbreaker', summary: "Vicarious Visions's GBA action-adventure adapts Anthony Horowitz's young adult spy novel following teenage MI6 agent Alex Rider through gadget-assisted stealth and combat missions tied to the 2006 film adaptation." },
      { gameId: 'airforce-delta-storm-game-boy-advance', title: 'Airforce Delta Storm', summary: "Konami's GBA aerial combat game delivers mission-based dogfighting across a campaign with multiple aircraft unlockable through score performance, adapting the franchise's flight combat to a top-down handheld perspective." },
      { gameId: 'army-men-advance-game-boy-advance', title: 'Army Men Advance', summary: "The GBA Army Men entry follows plastic soldiers through top-down action missions in the franchise's miniature-scale warfare setting, offering a portable interpretation of 3DO's long-running budget plastic toy soldier combat series." },
      { gameId: 'army-men-operation-green-game-boy-advance', title: 'Army Men: Operation Green', summary: "Majesco's GBA Army Men game delivers isometric plastic soldier combat across mission-based stages in the franchise's familiar miniaturized warfare setting, providing a portable continuation of the budget action series." },
      { gameId: 'army-men-turf-wars-game-boy-advance', title: 'Army Men: Turf Wars', summary: "The GBA Army Men entry delivers squad-based top-down combat across territorial control missions, following the franchise's plastic soldier warfare concept into a portable format focused on capturing and holding map positions." },
      { gameId: 'aero-the-acro-bat-game-boy-advance', title: 'Aero the Acro-Bat', summary: "The GBA port of Sunsoft's circus acrobat platformer brings Aero's drill-attack traversal and big-top stage themes to the handheld, adapting the 16-bit mascot franchise's second title to a portable format." },
      { gameId: 'adventure-island-game-boy-advance', title: 'Adventure Island', summary: "Hudson's GBA Adventure Island delivers the food-health platform formula of the original series in a handheld format, following Master Higgins through tropical stages with the franchise's characteristic rapid-timer health drain mechanic." },
      { gameId: 'an-american-tail-fievel-s-gold-rush-game-boy-advance', title: "An American Tail: Fievel's Gold Rush", summary: "The GBA licensed platformer follows the immigrant mouse Fievel through Gold Rush-era American West environments, adapting Don Bluth's animated character into a compact handheld action-platformer with western-themed stage design." },
      { gameId: 'action-man-robot-atak-game-boy-advance', title: 'Action Man: Robot Atak', summary: "Rage Software's GBA licensed action game follows the Hasbro action hero through robotic enemy combat in side-scrolling stages, delivering a portable entry in the European action figure brand's video game adaptations." },
      { gameId: '007-nightfire-game-boy-advance', title: '007: Nightfire', summary: "Gizmondo Studios' GBA adaptation of the Bond game delivers top-down stealth and action missions with a small arsenal of spy gadgets, scaling the console game's Phoenix criminal organization narrative to a compact handheld format." },
      { gameId: 'around-the-world-in-80-days-game-boy-advance', title: 'Around the World in 80 Days', summary: "The GBA adventure game adapts Jules Verne's classic novel of Phileas Fogg's wager-driven global circumnavigation into a portable action-adventure, following the Victorian gentleman through exotic international locations in a licensed handheld format." },
      { gameId: 'arthur-and-the-invisibles-game-boy-advance', title: 'Arthur and the Invisibles', summary: "The GBA licensed game based on Luc Besson's animated film follows Arthur in the miniature Minimoy world through side-scrolling stages, adapting the film's tiny-scale adventure to a compact portable format for the GBA hardware." },
      { gameId: 'backyard-skateboarding-game-boy-advance', title: 'Backyard Skateboarding', summary: "Humongous Entertainment's GBA entry in the Backyard Sports series applies the franchise's child athlete cast to skateboarding, delivering simple trick mechanics and ramp-based skating in a portable spin on the long-running licensed sports series." },
    ],
  },
  23: {
    label: 'PlayStation 2 wave 1',
    games: [
      { gameId: 'bully-playstation-2', title: 'Bully', summary: "Rockstar Vancouver's PS2 open-world game follows scholarship boy Jimmy Hopkins navigating the social hierarchy of Bullworth Academy through a school-year campaign, applying the Grand Theft Auto framework to a coming-of-age setting without the franchise's violence." },
      { gameId: 'burnout-playstation-2', title: 'Burnout', summary: "Criterion Games' PS2 racing debut introduces the Burnout meter charged by risky driving near traffic, rewarding oncoming-lane aggression with boost power in an arcade racer that prioritized crash spectacle and risk management over track mastery." },
      { gameId: 'burnout-2-point-of-impact-playstation-2', title: 'Burnout 2: Point of Impact', summary: "Criterion Games' PS2 sequel refines the boost risk mechanic with a Crash mode dedicated to causing maximum property damage in staged intersections, establishing the series' signature destruction spectacle alongside a longer circuit racing campaign." },
      { gameId: 'burnout-3-takedown-playstation-2', title: 'Burnout 3: Takedown', summary: "Criterion Games' PS2 entry shifts the franchise's damage focus onto deliberately ramming opponents into elimination, rewarding aggressive takedowns with boost and establishing the series peak that many regard as the definitive Burnout experience." },
      { gameId: 'castlevania-curse-of-darkness-playstation-2', title: 'Castlevania: Curse of Darkness', summary: "Konami's PS2 3D Castlevania follows Hector the Devil Forgemaster harvesting souls to create Innocent Devil companions that assist in combat, building an action RPG structure around the creature-crafting progression in a darker post-Symphony narrative." },
      { gameId: 'castlevania-lament-of-innocence-playstation-2', title: 'Castlevania: Lament of Innocence', summary: "Konami's PS2 3D Castlevania prequel establishes Leon Belmont as the origin of the vampire-hunting bloodline, delivering a hack-and-slash action game across sub-castle areas that explains the origin of the Vampire Killer whip and the Belmont legacy." },
      { gameId: 'champions-of-norrath-playstation-2', title: 'Champions of Norrath', summary: "Snowblind Studios' PS2 action RPG set in the EverQuest universe delivers four-player online and offline co-op dungeon crawling across five playable classes, porting the Baldur's Gate: Dark Alliance format into the established MMORPG fiction." },
      { gameId: 'champions-return-to-arms-playstation-2', title: 'Champions: Return to Arms', summary: "Snowblind Studios' PS2 sequel to Champions of Norrath expands the EverQuest hack-and-slash RPG with save import compatibility, additional character classes, and new planes of existence, deepening the co-op dungeon formula of the original." },
      { gameId: 'conflict-desert-storm-playstation-2', title: 'Conflict: Desert Storm', summary: "Pivotal Games' PS2 squad-based tactical shooter follows four-man SAS and Delta Force teams through Gulf War operations with distinct soldier specializations, establishing the Conflict series' signature squad command structure for consoles." },
      { gameId: 'crash-bandicoot-the-wrath-of-cortex-playstation-2', title: 'Crash Bandicoot: The Wrath of Cortex', summary: "Traveller's Tales' PS2 Crash debut maintains the corridor platformer format of the Naughty Dog trilogy with new vehicle stages and elemental titan antagonists, delivering a competent if familiar first next-gen entry for the Sony mascot franchise." },
      { gameId: 'def-jam-fight-for-ny-playstation-2', title: 'Def Jam: Fight for NY', summary: "EA Canada's PS2 hip-hop fighting game pits a vast roster of rap artists and athletes in brutal urban brawls with environment interaction and a deep custom fighter system, building the definitive licensed celebrity fighting experience of the PS2 era." },
      { gameId: 'destroy-all-humans-playstation-2', title: 'Destroy All Humans!', summary: "Pandemic Studios' PS2 open-world action comedy casts a 1950s alien as the aggressor reducing American citizens and military to ash with ray guns and psychic powers, delivering a satirical inversion of the alien invasion genre across a Cold War setting." },
      { gameId: 'devil-may-cry-playstation-2', title: 'Devil May Cry', summary: "Capcom's PS2 action game emerged from a Resident Evil 4 prototype to establish a new genre with demon hunter Dante's stylish combo-ranked sword-and-gun combat, defining character action and influencing a generation of action game design." },
      { gameId: 'devil-may-cry-2-playstation-2', title: 'Devil May Cry 2', summary: "Capcom's PS2 sequel reduces the mechanical depth of the original while expanding scale with two playable characters and larger environments, a divisive follow-up widely considered a step backward that redirected the franchise's design philosophy." },
      { gameId: 'digital-devil-saga-playstation-2', title: 'Digital Devil Saga', summary: "Atlus' PS2 Shin Megami Tensei spin-off follows a tribe of warriors who gain the power to devour enemies for abilities, building a dense turn-based press-turn combat system around elemental weakness exploitation and a philosophical narrative on identity." },
      { gameId: 'dot-hack-infection-playstation-2', title: '.hack//Infection', summary: "CyberConnect2's PS2 RPG simulates an MMORPG from within, following Kite exploring a fictional online game called The World while uncovering a mystery behind players falling into comas, blending MMORPG aesthetics with single-player RPG structure." },
      { gameId: 'drakengard-playstation-2', title: 'Drakengard', summary: "Cavia's PS2 action game pairs ground-based hack-and-slash combat with aerial dragon-riding dogfighting in a dark fantasy narrative dripping with morally compromised characters, establishing the transgressive tone that defined the Nier lineage." },
      { gameId: 'driving-emotion-type-s-playstation-2', title: 'Driving Emotion Type-S', summary: "Square's sole PS2 racing game delivers a Japanese touge-focused driving simulation with licensed cars and mountain pass circuits, notable as a technically ambitious but commercially overlooked first-party Square racing release on the hardware." },
      { gameId: 'dynasty-warriors-2-playstation-2', title: 'Dynasty Warriors 2', summary: "Omega Force's PS2 launch title redefines the Three Kingdoms franchise as a one-vs-thousands musou brawler, establishing the button-chain crowd-clearing combat loop and officer-hunting structure that became one of the era's most prolific franchises." },
      { gameId: 'early-to-rise-playstation-2', title: 'Amplitude', summary: "Harmonix's PS2 rhythm game follows a track through instrument lanes where players activate sequences to build a song's layers, establishing the music game design language that Harmonix would later apply to Guitar Hero and Rock Band." },
    ],
  },
  24: {
    label: 'Saturn wave 2 + NDS wave 3 + SNES/Genesis wave 6',
    games: [
      { gameId: 'cotton-boomerang-sega-saturn', title: 'Cotton Boomerang', summary: "Success's Japan-only Saturn entry in the witch-and-fairy shooter franchise expands the series with five playable characters including Cotton and her rivals, each with distinct shot types and subweapons in a horizontally scrolling candy-collecting shooter." },
      { gameId: 'criticom-sega-saturn', title: 'Criticom', summary: "Vic Tokai's Saturn 3D fighting game features a small roster of sci-fi warriors in arena combat, arriving as an early Saturn fighter attempt that suffered from slow frame rates and shallow mechanics despite ambitious pre-rendered character sprites." },
      { gameId: 'dungeon-master-ii-the-legend-of-skullkeep-sega-saturn', title: 'Dungeon Master II: The Legend of Skullkeep', summary: "FTL Games' Saturn port of the PC dungeon RPG sequel brings real-time first-person maze exploration and party management to the console, preserving the original's innovative real-time RPG combat in a platform port of a foundational PC dungeon crawler." },
      { gameId: 'daytona-usa-sega-saturn', title: 'Daytona USA', summary: "Sega's Saturn port of the 1993 arcade racing phenomenon delivers three oval and circuit tracks of the coin-op original to the home console, a technically challenged but commercially dominant Saturn launch title that defined the platform's early library." },
      { gameId: 'die-hard-arcade-sega-saturn', title: 'Die Hard Arcade', summary: "Sega's Saturn beat-'em-up uses the Die Hard license as window dressing over a police action brawler, featuring two-player co-op through a hostage rescue in a skyscraper with a weapons-from-environment system and a branching stage structure." },
      { gameId: 'digital-pinball-necronomicon-sega-saturn', title: 'Digital Pinball: Necronomicon', summary: "Sega's Japan-only Saturn pinball title features tables themed around the fictional Necronomicon tome with horror imagery and multiball sequences, delivering a technically polished physics simulation with a distinctive occult aesthetic." },
      { gameId: 'dragonheart-fire-and-steel-sega-saturn', title: 'Dragonheart: Fire & Steel', summary: "Universal's Saturn action-RPG tie-in to the 1996 Sean Connery film follows Bowen the dragon knight through combat stages collecting items, offering a budget-tier licensed game with limited gameplay depth tied to the film's fantasy adventure premise." },
      { gameId: 'dragon-force-sega-saturn', title: 'Dragon Force', summary: "Working Designs' Saturn strategy RPG governs eight kingdoms across a fantasy continent through massive 100-vs-100 troop battles, representing one of the Saturn's most acclaimed Japan-developed strategy titles with a deep faction-based campaign structure." },
      { gameId: 'darius-gaiden-sega-saturn', title: 'Darius Gaiden', summary: "Taito's Saturn port of the 1994 arcade shooter delivers the franchise's mechanical sea-beast bosses and three-screen cinematic origin's scale to the home console, with a branching stage tree and a Black Hole Bomb screen-clearing weapon that became iconic." },
      { gameId: 'earthworm-jim-2-sega-saturn', title: 'Earthworm Jim 2', summary: "Interplay's Saturn port of the SNES and Genesis sequel follows the suited worm through surreal stage types including a slo-mo opera sequence and a hamster launcher, expanding the original's platform-game parody with even wilder tonal variety." },
      { gameId: 'zelda-phantom-hourglass-nintendo-ds', title: 'The Legend of Zelda: Phantom Hourglass', summary: "Nintendo's DS Zelda sequel to Wind Waker uses the touchscreen exclusively for all movement and combat, building a ship-based ocean adventure around the Temple of the Ocean King dungeon that players return to repeatedly with new abilities." },
      { gameId: 'zelda-spirit-tracks-nintendo-ds', title: 'The Legend of Zelda: Spirit Tracks', summary: "Nintendo's second DS Zelda replaces Link's boat with a spirit train navigating fixed rails across New Hyrule, introducing a dual-protagonist structure where Zelda's ghost possesses Phantom knights in temple puzzle sections." },
      { gameId: 'pokemon-heartgold-nintendo-ds', title: 'Pokémon HeartGold', summary: "Game Freak's DS remake of Gold Version adds the Pokéwalker pedometer accessory, fully animated walking Pokémon companions, and the Battle Frontier post-game to the Johto adventure, elevating the Gold and Silver formula to fourth-generation standards." },
      { gameId: 'rhythm-heaven-nintendo-ds', title: 'Rhythm Heaven', summary: "Nintendo's DS rhythm game compiles dozens of micro-rhythm challenges using only the A button and screen taps, building its entire vocabulary from precise timing rather than note-matching, resulting in one of the DS era's most purely joyful experiences." },
      { gameId: 'shin-megami-tensei-strange-journey-nintendo-ds', title: 'Shin Megami Tensei: Strange Journey', summary: "Atlus' DS dungeon crawler sends a UN exploration team into a reality-consuming anomaly at the South Pole, delivering a first-person dungeon RPG with the franchise's demon negotiation and alignment system across a brutally demanding campaign." },
      { gameId: 'captain-commando-super-nintendo', title: 'Captain Commando', summary: "Capcom's SNES port of the 1991 arcade brawler brings four futuristic heroes through 26th-century crime-filled Metro City, scaling the coin-op's diverse weapon-based character combat and two-player co-op to the home console." },
      { gameId: 'cybernator-super-nintendo', title: 'Cybernator', summary: "NCS's SNES mecha game places a pilot in an Assault Suit through war-torn side-scrolling stages with selectable weapon loadouts, serving as an indirect sequel to the Genesis's Assault Suit Leynos with a more cinematic narrative presentation." },
      { gameId: 'contra-hard-corps-sega-genesis', title: 'Contra: Hard Corps', summary: "Konami's Genesis Contra entry offers four selectable characters with unique weapon sets across a campaign with multiple branching endings, delivering the franchise's most mechanically varied 16-bit entry with an uncompromising difficulty that rewarded mastery." },
      { gameId: 'comix-zone-sega-genesis', title: 'Comix Zone', summary: "Sega's Genesis beat-'em-up places hero Sketch Turner inside his own comic book pages, navigating panel-to-panel through hand-drawn environments against enemies spawned by the villain Mortus in a graphically inventive brawler with a distinctive visual premise." },
      { gameId: 'castlevania-bloodlines-sega-genesis', title: 'Castlevania: Bloodlines', summary: "Konami's sole Genesis Castlevania follows John Morris and Eric Lecarde through European locations tied to World War I vampire mythology, offering two distinct play styles and the franchise's most geographically varied 16-bit setting." },
    ],
  },
}

function makeBatchFile(batchNum, label, games) {
  const bN = batchNum
  const ids = games.map(g => `  '${g.gameId}'`).join(',\n')
  const entriesCode = games.map(g => `  {
    gameId: ${JSON.stringify(g.gameId)},
    title: ${JSON.stringify(g.title)},
    summary: ${JSON.stringify(g.summary)},
  }`).join(',\n')

  return `#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
${entriesCode},
]

function nowIso() { return new Date().toISOString() }
function hashValue(v) { return crypto.createHash('sha256').update(String(v||'')).digest('hex') }

function ensureGameIds(db, payload) {
  const rows = db.prepare(\`SELECT id FROM games WHERE id IN (\${payload.map(()=>'?').join(', ')})\`).all(...payload.map(e=>e.gameId))
  const ids = new Set(rows.map(r=>String(r.id)))
  const missing = payload.map(e=>e.gameId).filter(id=>!ids.has(id))
  if (missing.length) throw new Error('Missing target games in sqlite: ' + missing.join(', '))
}

function ensureSourceRecord(db, gameId, ts) {
  const ex = db.prepare(\`SELECT id FROM source_records WHERE entity_type='game' AND entity_id=? AND field_name='summary' AND source_name='internal' AND source_type='knowledge_registry' ORDER BY id DESC LIMIT 1\`).get(gameId)
  if (ex) { db.prepare(\`UPDATE source_records SET compliance_status='approved', last_verified_at=?, confidence_level=0.8, notes='G2 summary batch ${bN}' WHERE id=?\`).run(ts, ex.id); return Number(ex.id) }
  const r = db.prepare(\`INSERT INTO source_records (entity_type,entity_id,field_name,source_name,source_type,source_url,source_license,compliance_status,ingested_at,last_verified_at,confidence_level,notes) VALUES ('game',?,'summary','internal','knowledge_registry',NULL,NULL,'approved',?,?,0.8,'G2 summary batch ${bN}')\`).run(gameId, ts, ts)
  return Number(r.lastInsertRowid)
}

function ensureFieldProvenance(db, gameId, srcId, summary, ts) {
  const ex = db.prepare(\`SELECT id FROM field_provenance WHERE entity_type='game' AND entity_id=? AND field_name='summary' ORDER BY id DESC LIMIT 1\`).get(gameId)
  const vh = hashValue(summary)
  if (ex) { db.prepare(\`UPDATE field_provenance SET source_record_id=?, value_hash=?, is_inferred=0, confidence_level=0.8, verified_at=? WHERE id=?\`).run(srcId, vh, ts, ex.id); return false }
  db.prepare(\`INSERT INTO field_provenance (entity_type,entity_id,field_name,source_record_id,value_hash,is_inferred,confidence_level,verified_at) VALUES ('game',?,'summary',?,?,0,0.8,?)\`).run(gameId, srcId, vh, ts)
  return true
}

function upsertGameEditorialSummary(db, gameId, summary, srcId, ts) {
  db.prepare(\`INSERT INTO game_editorial (game_id,summary,source_record_id,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(game_id) DO UPDATE SET summary=excluded.summary, source_record_id=excluded.source_record_id, updated_at=excluded.updated_at\`).run(gameId, summary, srcId, ts, ts)
}

function createRun(db, runKey, ts, dry) {
  const r = db.prepare(\`INSERT INTO enrichment_runs (run_key,pipeline_name,mode,source_name,status,dry_run,started_at,items_seen,items_created,items_updated,items_skipped,items_flagged,error_count,notes) VALUES (?,'g2_summary_batch_${bN}','apply','internal_curated','running',?,?,0,0,0,0,0,0,'G2 batch ${bN} — ${label}')\`).run(runKey, dry?1:0, ts)
  return Number(r.lastInsertRowid)
}

function finalizeRun(db, runId, ts, m) {
  db.prepare(\`UPDATE enrichment_runs SET status='completed', finished_at=?, items_seen=?, items_created=0, items_updated=?, items_skipped=?, items_flagged=?, error_count=0, notes=? WHERE id=?\`).run(ts, m.itemsSeen, m.itemsUpdated, m.itemsSkipped, m.itemsFlagged, m.notes, runId)
}

function readBefore(db, payload) {
  const rows = db.prepare(\`SELECT id, summary FROM games WHERE id IN (\${payload.map(()=>'?').join(', ')})\`).all(...payload.map(e=>e.gameId))
  return new Map(rows.map(r=>[String(r.id), String(r.summary||'')]))
}

function dryRun(db) {
  const before = readBefore(db, G2_BATCH)
  return { targetedGames: G2_BATCH.length, summaryUpdates: G2_BATCH.filter(e=>!before.get(e.gameId).trim()).length, targets: G2_BATCH.map(e=>({ gameId: e.gameId, title: e.title, hadSummaryBefore: Boolean(before.get(e.gameId).trim()) })) }
}

function applyBatch(db) {
  const ts = nowIso()
  const runKey = 'g2-summary-batch-${bN}-' + ts
  const runId = createRun(db, runKey, ts, false)
  const m = { itemsSeen: G2_BATCH.length, itemsUpdated: 0, itemsSkipped: 0, itemsFlagged: 0, notes: 'G2 summary batch ${bN} applied locally on staging sqlite' }
  db.transaction(() => {
    for (const entry of G2_BATCH) {
      const srcId = ensureSourceRecord(db, entry.gameId, ts)
      db.prepare('UPDATE games SET summary=? WHERE id=?').run(entry.summary, entry.gameId)
      upsertGameEditorialSummary(db, entry.gameId, entry.summary, srcId, ts)
      ensureFieldProvenance(db, entry.gameId, srcId, entry.summary, ts)
      m.itemsUpdated++
    }
  })()
  finalizeRun(db, runId, nowIso(), m)
  return { runId, runKey, metrics: m }
}

function main() {
  const db = new Database(SQLITE_PATH)
  try {
    ensureGameIds(db, G2_BATCH)
    if (!APPLY) { console.log(JSON.stringify({ mode: 'dry-run', sqlitePath: SQLITE_PATH, summary: dryRun(db) }, null, 2)); return }
    console.log(JSON.stringify({ mode: 'apply', sqlitePath: SQLITE_PATH, summary: dryRun(db), result: applyBatch(db) }, null, 2))
  } finally { db.close() }
}

main()
`
}

for (const [batchNum, { label, games }] of Object.entries(BATCHES)) {
  const outPath = path.join(__dirname, `apply-g2-summary-batch-${batchNum}.js`)
  fs.writeFileSync(outPath, makeBatchFile(Number(batchNum), label, games))
  console.log(`wrote batch-${batchNum} (${games.length} games) → ${outPath}`)
}
