// Start splash screen
Game.Screen.startScreen = new Game.Screen.basicScreen({
    enter: function() { console.log('Entered teh start screen'); },
    exit: function() { console.log('Exited the start screen'); },
    render: function(display) {
        var w = Game.getScreenWidth();
        var h = Game.getScreenHeight();
        // Render prompt to the screen
        display.drawText((w/2) - 17, 5, "%c{yellow}[Your Game]%c{white}, a JavaScript Roguelike");
        display.drawText((w/2) - 15, 6, "Press [?] at any time for help");
        display.drawText((w/2) - 12, 8, "Press [Enter] to start!");
    },
    handleInput: function(inputType, inputData) {
        // When [Enter] is pressed, go to the play screen
        if(inputType === 'keydown' && inputData.keyCode === ROT.VK_RETURN) {
            Game.switchScreen(Game.Screen.loadScreen);
        }
    }
});

// Displayed while files are loading and things are being generated
Game.Screen.loadScreen = new Game.Screen.basicScreen({
    enter: function() {
        // Register test modules
        Game.loadProgress.registerModule('Map');
        Game.loadProgress.registerModule('Map', 'Lava');
        Game.loadProgress.registerModule('Map', 'Water');
        Game.loadProgress.registerModule('Map', 'Gold');
        Game.loadProgress.registerModule('Monsters');
        Game.loadProgress.registerModule('Items');
    },
    exit: function() {},
    render: function(display) {
        var w = Game.getScreenWidth();
        var h = Game.getScreenHeight();
        var progress = Game.loadProgress.getProgress();

        // 100 being the max progress number
        var barWidthMax = (w - 2) / 100; // -2 to account for end brackets

        // Due to an anomaly with l and rpad, 0 will add a pad, 1 will not (since
        // it gets the diff) so, if barWidth or barDiff are 0, then default to 1.
        var barWidth = progress * barWidthMax || 1;
        if(barWidth === 100 * barWidthMax)
            barWidth -= 1; // So as to account for the cap char
        var barDiff = (100 * barWidthMax) - barWidth || 1;
        var bar = "[".rpad("=", barWidth);
        var end = "]".lpad(" ", barDiff);
        var progressBar = bar + end; // The length of this string should always be 78 (or w - 2)

        // Render prompt to the screen
        display.drawText((w/2) - 5, 5, "%c{yellow}Loading...");
        display.drawText((w/2) - (progressBar.length / 2), 7, progressBar);
        if(progress < 1)
            display.drawText((w/2) - 15, 9, "Press [Enter] to begin loading!");
        if(progress >= 100)
            display.drawText((w/2) - 24, 9, "Press [Enter] to play or [Escape] to load again!");
    },
    handleInput: function(inputType, inputData) {
        // Purely as a demo, not functionally loading anything
        var numModules = 5,
            iterations = numModules * 10,
            currIteration = 1;

        Game.loadProgress.startModule('Map');
        function loadModules() {
            switch(currIteration % numModules) {
                case 0:
                    Game.loadProgress.startSubmodule('Map', 'Lava');
                    Game.loadProgress.updateSubmodule('Map', 'Lava', currIteration * 2);
                    break;
                case 1:
                    Game.loadProgress.startSubmodule('Map', 'Water');
                    Game.loadProgress.updateSubmodule('Map', 'Water', currIteration * 2);
                    break;
                case 2:
                    Game.loadProgress.startSubmodule('Map', 'Gold');
                    Game.loadProgress.updateSubmodule('Map', 'Gold', currIteration * 2);
                    break;
                case 3:
                    Game.loadProgress.startModule('Monsters');
                    Game.loadProgress.updateModule('Monsters', currIteration * 2);
                    break;
                case 4:
                    Game.loadProgress.startModule('Items');
                    Game.loadProgress.updateModule('Items', currIteration * 2);
                    break;
                default:
                    break;
            }

            if(currIteration === iterations) {
                Game.loadProgress.finishModule('Map');
                Game.loadProgress.finishModule('Monsters');
                Game.loadProgress.finishModule('Items');
                clearInterval(window.intervalID);
            } else {
                currIteration++;
            }

            Game.refresh();
        }

        if(inputType == 'keydown') {
            if(Game.loadProgress.getProgress() < 100) {
                if(inputData.keyCode === ROT.VK_RETURN)
                    window.intervalID = setInterval(loadModules, 50);
                else if(inputData.keyCode === ROT.VK_ESCAPE)
                    clearInterval(window.intervalID);
            } else {
                if(inputData.keyCode === ROT.VK_RETURN)
                    Game.switchScreen(Game.Screen.playScreen);
                else if(inputData.keyCode === ROT.VK_ESCAPE)
                    window.intervalID = setInterval(loadModules, 50);
            }
        }
    }
});
// Main play screen
Game.Screen.playScreen = new Game.Screen.basicScreen({
    _player: null,
    _gameEnded: false,
    _subScreen: null,
    enter: function() {
        var width = 100;
        var height = 48;
        var depth = 6;

        // Create our map from the tiles and player
        this._player = new Game.Entity(Game.PlayerTemplate);
        var map = new Game.Map(width, height, depth, this._player);
        // Start the map's engine
        map.getEngine().start();
    },
    exit: function() { console.log("Exited play screen."); },
    render: function(display) {
        // Render subscreen if there is one
        if (this._subScreen) {
            this._subScreen.render(display);
            return;
        }

        // Otherwise, procede as usual...
        var screenWidth = Game.getScreenWidth();
        var screenHeight = Game.getScreenHeight();

        // Render the tiles
        this.renderTiles(display);

        // Get the messages in the player's queue and render them
        var messages = this._player.getMessages();
        var messageY = 0;
        for (var i = 0; i < messages.length; i++) {
            // Draw each message, adding the number of lines
            messageY += display.drawText(
                0,
                messageY,
                '%c{white}%b{black}' + messages[i]
            );
        }

        // Render player HP
        var stats = '%c{white}%b{black}';
        stats += String.format(
            'HP: %s/%s Level: %s XP: %s',
            this._player.getHp(),
            this._player.getMaxHp(),
            this._player.getLevel(),
            this._player.getExperience()
        );
        display.drawText(0, screenHeight, stats);

        // Render hunger state
        var hungerState = this._player.getHungerState();
        display.drawText(screenWidth - hungerState.length, screenHeight, hungerState);
    },
    move: function(dX, dY, dZ) {
        var newX = this._player.getX() + dX;
        var newY = this._player.getY() + dY;
        var newZ = this._player.getZ() + dZ;
        this._player.tryMove(newX, newY, newZ, this._player.getMap());
    },
    handleInput: function(inputType, inputData) {
        // If the game is over, enter will bring the user to the losing screen.
        if(this._gameEnded) {
            if (inputType === 'keydown' && inputData.keyCode === ROT.VK_RETURN) {
                Game.switchScreen(Game.Screen.loseScreen);
            }
            // Return to make sure the user can't still play
            return;
        }
        // Handle subscreen input if there is one
        if (this._subScreen) {
            this._subScreen.handleInput(inputType, inputData);
            return;
        }

        var command = Game.Input.handleInput('playScreen', inputType, inputData);
        var unlock = command ? command(this._player) : false;

        if(unlock)
            this._player.getMap().getEngine().unlock();
        else
            Game.refresh();
    },
    getScreenOffsets: function() {
        // Make sure we still have enough space to fit an entire game screen
        var topLeftX = Math.max(0, this._player.getX() - (Game.getScreenWidth() / 2));
        // Make sure we still have enough space to fit an entire game screen
        topLeftX = Math.min(topLeftX, this._player.getMap().getWidth() - Game.getScreenWidth());
        // Make sure the y-axis doesn't above the top bound
        var topLeftY = Math.max(0, this._player.getY() - (Game.getScreenHeight() / 2));
        // Make sure we still have enough space to fit an entire game screen
        topLeftY = Math.min(topLeftY, this._player.getMap().getHeight() - Game.getScreenHeight());
        return {
            x: topLeftX,
            y: topLeftY
        };
    },
    renderTiles: function(display) {
        var screenWidth = Game.getScreenWidth();
        var screenHeight = Game.getScreenHeight();
        var offsets = this.getScreenOffsets();
        var topLeftX = offsets.x;
        var topLeftY = offsets.y;
        // This object will keep track of all visible map cells
        var visibleCells = {};
        // Store this._player.getMap() and player's z to prevent losing it in callbacks
        var map = this._player.getMap();
        var currentDepth = this._player.getZ();
        // Find all visible cells and update the object
        map.getFov(currentDepth).compute(
            this._player.getX(), this._player.getY(),
            this._player.getSightRadius(),
            function(x, y, radius, visibility) {
                visibleCells[x + "," + y] = true;
                // Mark cell as explored
                map.setExplored(x, y, currentDepth, true);
            });
        // Iterate through visible map cells
        for (var x = topLeftX; x < topLeftX + screenWidth; x++) {
            for (var y = topLeftY; y < topLeftY + screenHeight; y++) {
                if (map.isExplored(x, y, currentDepth)) {
                    // Fetch the glyph for the tile and render it to the screen
                    // at the offset position.
                    var glyph = map.getTile(x, y, currentDepth);
                    var foreground = glyph.getForeground();
                    // If we are at a cell that is in the field of vision, we need
                    // to check if there are items or entities.
                    if (visibleCells[x + ',' + y]) {
                        // Check for items first, since we want to draw entities
                        // over items.
                        var items = map.getItemsAt(x, y, currentDepth);
                        // If we have items, we want to render the top most item
                        if (items) {
                            glyph = items[items.length - 1];
                        }
                        // Check if we have an entity at the position
                        if (map.getEntityAt(x, y, currentDepth)) {
                            glyph = map.getEntityAt(x, y, currentDepth);
                        }
                        // Update the foreground color in case our glyph changed
                        foreground = glyph.getForeground();
                    } else {
                        // Since the tile was previously explored but is not
                        // visible, we want to change the foreground color to
                        // dark gray.
                        foreground = 'darkGray';
                    }

                    display.draw(
                        x - topLeftX,
                        y - topLeftY,
                        glyph.getChar(),
                        foreground,
                        glyph.getBackground());
                }
            }
        }

        // Render the entities
        var entities = this._player.getMap().getEntities();
        for (var key in entities) {
            var entity = entities[key];
            if (visibleCells[entity.getX() + ',' + entity.getY()]) {
                // Only render the entity if they would show up on the screen
                if(entity.getX() < topLeftX + screenWidth &&
                    entity.getX() >= topLeftX &&
                    entity.getY() < topLeftY + screenHeight &&
                    entity.getY() >= topLeftY &&
                    entity.getZ() == this._player.getZ()) {
                    display.draw(
                        entity.getX() - topLeftX,
                        entity.getY() - topLeftY,
                        entity.getChar(),
                        entity.getForeground(),
                        entity.getBackground()
                    );
                }
            }
        }
    },
    setGameEnded: function(gameEnded) {
        this._gameEnded = gameEnded;
    },
    getSubScreen: function() {
        return this._subScreen;
    },
    setSubScreen: function(subScreen) {
        this._subScreen = subScreen;
        Game.refresh();
    },
    showItemsSubScreen: function(subScreen, items, emptyMessage) {
        if (items && subScreen.setup(this._player, items) > 0) {
            this.setSubScreen(subScreen);
        } else {
            Game.sendMessage(this._player, emptyMessage);
            Game.refresh();
        }
    }
});

// Inventory sub-screens
Game.Screen.inventoryScreen = new Game.Screen.ItemListScreen({
    caption: 'Inventory',
    canSelect: false
});
Game.Screen.pickupScreen = new Game.Screen.ItemListScreen({
    caption: 'Choose the items you wish to pickup',
    canSelect: true,
    canSelectMultipleItems: true,
    ok: function(selectedItems) {
        // Try to pick up all items, messaging the player if they couldn't all be picked up.
        if (!this._player.pickupItems(Object.keys(selectedItems))) {
            Game.sendMessage(this._player, "Your inventory is full! Not all items were picked up.");
        }
        return true;
    }
});
Game.Screen.dropScreen = new Game.Screen.ItemListScreen({
    caption: 'Choose the item you wish to drop',
    canSelect: true,
    canSelectMultipleItems: false,
    ok: function(selectedItems) {
        // Drop the selected item
        this._player.dropItem(Object.keys(selectedItems)[0]);
        return true;
    }
});
Game.Screen.eatScreen = new Game.Screen.ItemListScreen({
    caption: 'Choose the item you wish to eat',
    canSelect: true,
    canSelectMultipleItems: false,
    isAcceptable: function(item) {
        return item && item.hasMixin('Edible') && item !== this._player._armor && item !== this._player._weapon;
    },
    ok: function(selectedItems) {
        // Eat the item, removing it if there are no consumptions remaining.
        var key = Object.keys(selectedItems)[0];
        var item = selectedItems[key];
        Game.sendMessage(this._player, "You eat %s.", [item.describeThe()]);
        item.eat(this._player);
        if (!item.hasRemainingConsumptions()) {
            this._player.removeItem(key);
        }
        return true;
    }
});
Game.Screen.wieldScreen = new Game.Screen.ItemListScreen({
    caption: 'Choose the item you wish to wield',
    canSelect: true,
    canSelectMultipleItems: false,
    hasNoItemOption: true,
    isAcceptable: function(item) {
        return item && item.hasMixin('Equippable') && item.isWieldable();
    },
    ok: function(selectedItems) {
        // Check if we selected 'no item'
        var keys = Object.keys(selectedItems);
        if (keys.length === 0) {
            this._player.unwield();
            Game.sendMessage(this._player, "You are empty handed.")
        } else {
            // Make sure to unequip the item first in case it is the armor.
            var item = selectedItems[keys[0]];
            this._player.unequip(item);
            this._player.wield(item);
            Game.sendMessage(this._player, "You are wielding %s.", [item.describeA()]);
        }
        return true;
    }
});
Game.Screen.wearScreen = new Game.Screen.ItemListScreen({
    caption: 'Choose the item you wish to wear',
    canSelect: true,
    canSelectMultipleItems: false,
    hasNoItemOption: true,
    isAcceptable: function(item) {
        return item && item.hasMixin('Equippable') && item.isWearable();
    },
    ok: function(selectedItems) {
        // Check if we selected 'no item'
        var keys = Object.keys(selectedItems);
        if (keys.length === 0) {
            this._player.unwield();
            Game.sendMessage(this._player, "You are not wearing anthing.")
        } else {
            // Make sure to unequip the item first in case it is the weapon.
            var item = selectedItems[keys[0]];
            this._player.unequip(item);
            this._player.wear(item);
            Game.sendMessage(this._player, "You are wearing %s.", [item.describeA()]);
        }
        return true;
    }
});
Game.Screen.examineScreen = new Game.Screen.ItemListScreen({
    caption: 'Choose the item you wish to examine',
    canSelect: true,
    canSelectMultipleItems: false,
    isAcceptable: function(item) {
        return true;
    },
    ok: function(selectedItems) {
        var keys = Object.keys(selectedItems);
        if (keys.length > 0) {
            var item = selectedItems[keys[0]];
            var description = "It's %s";
            var details = item.details();
            if(details && details != "") {
                description += " (%s).";
                Game.sendMessage(this._player, description,
                [
                    item.describeA(false),
                    item.details()
                ]);
            } else {
                Game.sendMessage(this._player, description, [item.describeA(false)]);
            }

        }
        return true;
    }
});
Game.Screen.throwScreen = new Game.Screen.ItemListScreen({
    caption: 'Choose the item you wish to throw',
    canSelect: true,
    canSelectMultipleItems: false,
    isAcceptable: function(item) {
        if(!item || !item.hasMixin('Throwable')) {
            return false;
        } else if(item.hasMixin('Equippable') && (item.isWielded() || item.isWorn())) {
            return false
        } else {
            return true;
        }
    },
    ok: function(selectedItems) {
        var offsets = Game.Screen.playScreen.getScreenOffsets();
        // Go to the targetting screen
        Game.Screen.throwTargetScreen.setup(this._player, this._player.getX(), this._player.getY(), offsets.x, offsets.y);
        this._player.setThrowing(Object.keys(selectedItems)[0]);
        Game.Screen.playScreen.setSubScreen(Game.Screen.throwTargetScreen);
        return;
    }
});

// Target-based screens
Game.Screen.lookScreen = new Game.Screen.TargetBasedScreen({
    captionFunction: function(x, y) {
        var z = this._player.getZ();
        var map = this._player.getMap();
        // If the tile is explored, we can give a better caption
        if (map.isExplored(x, y, z)) {
            // If the tile isn't explored, we have to check if we can actually
            // see it before testing if there's an entity or item.
            if (this._visibleCells[x + ',' + y]) {
                var items = map.getItemsAt(x, y, z);
                // If we have items, we want to render the top most item
                if (items) {
                    var item = items[items.length - 1];
                    return String.format('%s - %s (%s)',
                        item.getRepresentation(),
                        item.describeA(true),
                        item.details());
                // Else check if there's an entity
                } else if (map.getEntityAt(x, y, z)) {
                    var entity = map.getEntityAt(x, y, z);
                    return String.format('%s - %s (%s)',
                        entity.getRepresentation(),
                        entity.describeA(true),
                        entity.details());
                }
            }
            // If there was no entity/item or the tile wasn't visible, then use
            // the tile information.
            return String.format('%s - %s',
                map.getTile(x, y, z).getRepresentation(),
                map.getTile(x, y, z).getDescription());

        } else {
            var nullTile = Game.TileRepository.create('null');
            // If the tile is not explored, show the null tile description.
            return String.format('%s - %s',
                nullTile.getRepresentation(),
                nullTile.getDescription());
        }
    }
});
Game.Screen.throwTargetScreen = new Game.Screen.TargetBasedScreen({
    captionFunction: function(x, y, points) {
        var throwing = this._player.getItems()[this._player.getThrowing()];
        var throwingSkill = this._player.getThrowingSkill();
        var entity = this._player.getMap().getEntityAt(x, y, this._player.getZ());
        console.log(entity);
        var string = String.format("You are throwing %s", throwing.describeA());
        if(entity) {
            string += String.format(" at %s", entity.describeA());
        }
        if(points.length > throwingSkill) {
            string += " - Might not do as much damage at this range"
        }
        return string;
    },
    okFunction: function(x, y) {
        this._player.throwItem(this._player.getThrowing(), x, y);
        return true;
    }
});

// Menu-based screens
Game.Screen.actionMenu = new Game.Screen.MenuScreen({
    caption: 'Action Menu',
    buildMenuItems: function() {
        var adjacentCoords = Game.Geometry.getCircle(this._player.getX(), this._player.getY(), 1),
            map = this._player.getMap(),
            z = this._player.getZ(),
            actions = [];

        // Populate a list of actions with which to build the menu
        for(var i = 0; i < adjacentCoords.length; i++) {
            var coords = adjacentCoords[i].split(","),
                x = coords[0],
                y = coords[1];

            var entity = map.getEntityAt(x, y, z),
                items = map.getItemsAt(x, y, z);

            if(entity) {
                var entityActions = entity.raiseEvent('action', this._player);
                if(entityActions) actions.push(entityActions);
            }
            if(items) {
                for(var j = 0; j < items.length; j++) {
                    var itemActions = items[j].raiseEvent('action', this._player);
                    if(itemActions) actions.push(itemActions);
                }
            }
        }

        // Iterate through the actions, building out the _menuItems and _menuActions arrays
        for(var k = 0; k < actions.length; k++) {
            var glyphActions = actions[k]; // An array of action objects
            for (var l = 0; l < glyphActions.length; l++) {
                // An object of action name/functions pairs returned by each relevant item-mixin listener
                var mixinActions = glyphActions[l];
                for(var actionName in mixinActions) {
                    this._menuItems.push(actionName);
                    this._menuActions.push(mixinActions[actionName]);
                }
            }
        }
    }
});

// Help screen
Game.Screen.helpScreen = new Game.Screen.basicScreen({
    enter: function(display) {},
    exit: function(display) {},
    render: function(display) {
        var text = '[Your Roguelike] Help';
        var border = '---------------';
        var y = 0;
        display.drawText(Game.getScreenWidth() / 2 - text.length / 2, y++, text);
        display.drawText(Game.getScreenWidth() / 2 - text.length / 2, y++, border);
        y += 3;
        display.drawText(0, y++, 'Arrow keys to move');
        display.drawText(0, y++, '[<] to go up stairs');
        display.drawText(0, y++, '[>] to go down stairs');
        display.drawText(0, y++, '[,] to pick up items');
        display.drawText(0, y++, '[d] to drop items');
        display.drawText(0, y++, '[e] to eat items');
        display.drawText(0, y++, '[w] to wield items');
        display.drawText(0, y++, '[W] to wear items');
        display.drawText(0, y++, '[t] to throw items');
        display.drawText(0, y++, '[x] to examine items');
        display.drawText(0, y++, '[;] to look around you');
        display.drawText(0, y++, '[?] to show this help screen');
        y += 3;
        text = '--- press any key to continue ---';
        display.drawText(Game.getScreenWidth() / 2 - text.length / 2, y++, text);
    },
    handleInput: function(inputType, inputData) {
        Game.Screen.playScreen.setSubScreen(null);
    }
});


// Level-up screen
Game.Screen.gainStatScreen = new Game.Screen.basicScreen({
    enter: function(entity) {
        // Must be called before rendering.
        this._entity = entity;
        this._options = entity.getStatOptions();
        Game.Screen.playScreen.setSubScreen(Game.Screen.gainStatScreen);
    },
    exit: function() {
        Game.Screen.playScreen.setSubScreen(undefined);
    },
    render: function(display) {
        var letters = 'abcdefghijklmnopqrstuvwxyz';
        display.drawText(0, 0, 'Choose a stat to increase: ');

        // Iterate through each of our options
        for (var i = 0; i < this._options.length; i++) {
            display.drawText(0, 2 + i, letters.substring(i, i + 1) + ' - ' + this._options[i][0]);
        }

        // Render remaining stat points
        display.drawText(0, 4 + this._options.length, "Remaining points: " + this._entity.getStatPoints());
    },
    handleInput: function(inputType, inputData) {
        if (inputType === 'keydown') {
            // If a letter was pressed, check if it matches to a valid option.
            if (inputData.keyCode >= ROT.VK_A && inputData.keyCode <= ROT.VK_Z) {
                // Check if it maps to a valid item by subtracting 'a' from the character
                // to know what letter of the alphabet we used.
                var index = inputData.keyCode - ROT.VK_A;
                if (this._options[index]) {
                    // Call the stat increasing function
                    this._options[index][1].call(this._entity);
                    // Decrease stat points
                    this._entity.setStatPoints(this._entity.getStatPoints() - 1);
                    // If we have no stat points left, exit the screen, else refresh
                    if (this._entity.getStatPoints() === 0) {
                        this.exit();
                    } else {
                        Game.refresh();
                    }
                }
            }
        }
    }
});

// Define our winning screen
Game.Screen.winScreen = new Game.Screen.basicScreen({
    enter: function() { console.log("Entered win screen."); },
    exit: function() { console.log("Exited win screen."); },
    render: function(display) {
        // Render our prompt to the screen
        for (var i = 0; i < 22; i++) {
            // Generate random background colors
            var r = Math.round(Math.random() * 255);
            var g = Math.round(Math.random() * 255);
            var b = Math.round(Math.random() * 255);
            var background = ROT.Color.toRGB([r, g, b]);
            display.drawText(2, i + 1, "%b{" + background + "}You win!");
        }
    },
    handleInput: function(inputType, inputData) {
        if(inputType === 'keydown' && inputData.keyCode === ROT.VK_RETURN) {
            Game.switchScreen(Game.Screen.playScreen);
        }
    }
});

// Define our winning screen
Game.Screen.loseScreen = new Game.Screen.basicScreen({
    enter: function() { console.log("Entered lose screen."); },
    exit: function() { console.log("Exited lose screen."); },
    render: function(display) {
        // Render our prompt to the screen
        for (var i = 0; i < 22; i++) {
            display.drawText(2, i + 1, "%b{red}You lose! :(");
        }
    },
    handleInput: function(inputType, inputData) {
        if(inputType === 'keydown' && inputData.keyCode === ROT.VK_RETURN) {
            Game.Screen.playScreen.setGameEnded(true);
            Game.switchScreen(Game.Screen.startScreen);
        }
    }
});
