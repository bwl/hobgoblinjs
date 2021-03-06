Game.Screen = {};

Game.Screen.basicScreen = function(properties) {
    var requiredMethods = [
        'enter',
        'exit',
        'render',
        'handleInput'
    ];

    // Make sure they have the required methods...
    for(var i = 0; i < requiredMethods.length; i++) {
        var method = requiredMethods[i];
        if(properties[method] === undefined)
            throw new Error("'" + method + "' is a missing from your properties list and is required for this type of screen");
    }

    // Set properties for the screen
    if(properties) {
        for(var p in properties) {
            if(!this[p]) {
                this[p] = properties[p];
            }
        }
    }
};

// Item Listing
Game.Screen.ItemListScreen = function(template) {
    // Set up based on the template
    this._caption = template['caption'];
    this._okFunction = template['ok'];
    // By default, we use the identity function
    this._isAcceptableFunction = template['isAcceptable'] || function(x) {
        return x;
    };

    // Can the user select items at all?
    this._canSelectItem = template['canSelect'];

    // Can they select multiple items?
    this._canSelectMultipleItems = template['canSelectMultipleItems'];

    // Whether a 'no item' option should appear.
    this._hasNoItemOption = template['hasNoItemOption'];
};
Game.Screen.ItemListScreen.prototype.setup = function(player, items) {
    this._player = player;
    // Should be called before switching to the screen.
    var count = 0;
    // Iterate over each item, keeping only the aceptable ones and counting the number of acceptable items.
    var that = this;
    this._items = items.map(function(item) {
        // Transform the item into null if it's not acceptable
        if (that._isAcceptableFunction(item)) {
            count++;
            return item;
        } else {
            return null;
        }
    });

    // Clean set of selected indices
    this._selectedIndices = {};
    return count;
};
Game.Screen.ItemListScreen.prototype.render = function(display) {
    var letters = 'abcdefghijklmnopqrstuvwxyz';
    // Render the no item row if enabled
    if (this._hasNoItemOption) {
        display.drawText(0, 1, '0 - no item');
    }
    // Render the caption in the top row
    display.drawText(0, 0, this._caption);
    var row = 0;
    for(var i = 0; i < this._items.length; i++) {
        // If we have an item, we want to render it
        if(this._items[i]) {
            // Get the letter corresponding to the item's index
            var letter = letters.substring(i, i + 1);

            // If the item is selected, show a +, otherwise show a dash, then the item's name
            var selectionState = (this._canSelectItem && this._canSelectMultipleItems && this._selectedIndices[i]) ? '+' : '-';

            // If the item is stackable, show the number we are currently holding
            var stack = this._items[i].hasMixin('Stackable') ? ' (' + this._items[i].amount() + ')' : '';

            // Render at the correct row and add 2
            display.drawText(0, 2 + row, letter + ' ' + selectionState + ' ' + this._items[i].describe() + stack);
            row++;
        }
    }
};
Game.Screen.ItemListScreen.prototype.executeOkFunction = function() {
    // Gather the selected items.
    var selectedItems = {};
    for (var key in this._selectedIndices) {
        selectedItems[key] = this._items[key];
    }

    // Switch back to play screen
    Game.Screen.playScreen.setSubScreen(undefined);

    // Return the result of the okFunction
    return this._okFunction ? this._okFunction(selectedItems) : false;
};
Game.Screen.ItemListScreen.prototype.handleInput = function(inputType, inputData) {
    var command = Game.Input.handleInput("ItemListScreen", inputType, inputData);

    // Execute the command, and caputure return value
    var unlock = command ? command() : false;

    // If the return value is true, unlock the engine (player turn over)
    if(unlock)
        this._player.getMap().getEngine().unlock();
    else
        Game.refresh();
};

// Targeting Screen
Game.Screen.TargetBasedScreen = function(template) {
    template = template || {};
    // By default, our ok return does nothing and does not consume a turn.
    this._okFunction = template['okFunction'] || function(x, y) {
        return false;
    };
    // The default caption function returns a description of the tiles or creatures.
    this._captionFunction = template['captionFunction'] || function(x, y) {
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
    };
};
Game.Screen.TargetBasedScreen.prototype.setup = function(player, startX, startY, offsetX, offsetY) {
    this._player = player;
    // Store original position. Subtract the offset so we don't always have to remove it.
    this._startX = startX - offsetX;
    this._startY = startY - offsetY;
    // Store current cursor position
    this._cursorX = this._startX;
    this._cursorY = this._startY;
    // Store map offsets
    this._offsetX = offsetX;
    this._offsetY = offsetY;
    // Cache the FOV
    var visibleCells = {};
    this._player.getMap().getFov(this._player.getZ()).compute(
        this._player.getX(), this._player.getY(),
        this._player.getSightRadius(),
        function(x, y, radius, visibility) {
            visibleCells[x + "," + y] = true;
        });
    this._visibleCells = visibleCells;
};
Game.Screen.TargetBasedScreen.prototype.render = function(display) {
    Game.Screen.playScreen.renderTiles.call(Game.Screen.playScreen, display);

    // Draw a line from the start to the cursor.
    var points = Game.Geometry.getLine(this._startX, this._startY, this._cursorX, this._cursorY);

    // Render stars along the line.
    for (var i = 1, l = points.length; i < l; i++) {
        if(i == l - 1) {
            display.drawText(points[i].x, points[i].y, '%c{white}X');
        } else {
            display.drawText(points[i].x, points[i].y, '%c{white}*');
        }

    }

    // Render the caption at the bottom.
    display.drawText(0, Game.getScreenHeight() - 1,
        this._captionFunction(this._cursorX + this._offsetX, this._cursorY + this._offsetY));
};
Game.Screen.TargetBasedScreen.prototype.handleInput = function(inputType, inputData) {
    var command = Game.Input.handleInput("TargetBasedScreen", inputType, inputData);
    var unlock = command ? command() : false;

    // If the return value is true, unlock the engine (player turn over)
    if(unlock)
        this._player.getMap().getEngine().unlock();
    else
        Game.refresh();
};
Game.Screen.TargetBasedScreen.prototype.moveCursor = function(dx, dy) {
    // Make sure we stay within bounds.
    this._cursorX = Math.max(0, Math.min(this._cursorX + dx, Game.getScreenWidth()));
    // We have to save the last line for the caption.
    this._cursorY = Math.max(0, Math.min(this._cursorY + dy, Game.getScreenHeight() - 1));
};
Game.Screen.TargetBasedScreen.prototype.executeOkFunction = function() {
    if(this._okFunction)
        return this._okFunction(this._cursorX + this._offsetX, this._cursorY + this._offsetY);
    else
        return false;
};

// Menu screens
Game.Screen.MenuScreen = function(template) {
    template = template || {};

    this._player = null;

    // Display settings
    this._caption = template['caption'] || 'Menu';
    this._outerPadding = template['outerPadding'] || 4;
    this._innerPadding = template['innerPadding'] || 2;
    this._width = template['width'] || Game.getScreenWidth() - this._outerPadding;
    this._height = template['height'] || Game.getScreenHeight() - this._outerPadding;
    this._textWidth = this._width - this._innerPadding;
    this._verticalChar = template['verticalChar'] || '|';
    this._horizontalChar = template['horizontalChar'] || '-';
    this._cornerChar = template['cornerChar'] || '+';
    this._highlightColor = template['highlightColor'] || Game.Palette.blue;

    // Menu item settings
    this._currentIndex = template['currentIndex'] || 0;
    this._menuItems = template['menuItems'] || [];
    this._menuActions = template['menuActions'] || [];
    this._buildMenuItems = template['buildMenuItems'] || function() {
        // The the value of each menu item should be an array of arrays, where the first value of each sub array is a function reference, and the second value is an array of parameters, such that the menu action can be called via menuAction[i][0].apply(this, menuAction[i][1]). This data structure allows for as many function calls with as many arguments to be called sequentially by a single menu action.
        var exampleMenuItem = {
            'Example 1': [[console.log, ['This is an example', ', and another.']], [console.log, ['And another!']]],
            'Example 2': [[console.log, ['This is another example', ', and another.']], [console.log, ['And another!!']]]
        };
        for(var item in exampleMenuItem) {
            this._menuItems.push(item);
            this._menuActions.push(exampleMenuItem[item]);
        }
    };
    this._okFunction = template['ok'] || function() {
        var menuActions = this._menuActions[this._currentIndex];
        for (var i = 0; i < menuActions.length; i++) {
            if(menuActions[i].length !== 2 && menuActions[i].length !== 3)
                throw new Error('Incorrectly formatted action type:', menuActions[i]);
            var actionFunc = menuActions[i][0],
                actionArgs = menuActions[i][1],
                actionContext = (menuActions[i].length === 3) ? menuActions[i][2] : actionFunc;

            actionFunc.apply(actionContext, actionArgs);
        }
        return true;
    };
};
Game.Screen.MenuScreen.prototype.setup = function(player, builderArgs) {
    this._player = player;
    this._currentIndex = 0; // reset current index to 0
    this._menuItems = []; // clear out old menu items;
    this._menuActions = []; // clear out old menu items;
    this._buildMenuItems.apply(this, builderArgs);
};
Game.Screen.MenuScreen.prototype.render = function(display) {
    var startX = this._outerPadding,
        startY = this._outerPadding;

    // Draw caption
    display.drawText(
        Math.round(this._width / 2) - Math.round(this._caption.length / 2),
        startY - 1,
        '%c{' + Game.Palette.blue + '}' + this._caption + '%c{}'
    );
    // Draw menu box
    for (var row = 0; row < this._height; row++) {
        if(row === 0 || row === this._height - 1) {
            display.drawText(
                startX,
                startY + row,
                this._cornerChar.rpad(this._horizontalChar, this._width - 2) + this._cornerChar,
                this._width
            );
        } else {
            display.drawText(
                startX,
                startY + row,
                this._verticalChar.rpad(" ", this._width - 2) + this._verticalChar,
                this._width
            );
        }
    }

    // Draw menu items
    for (var item = 0; item < this._menuItems.length; item++) {
        var highlight;
        if(item === this._currentIndex)
            highlight = '%b{' + this._highlightColor + '}';
        else
            highlight = '%b{}';

        display.drawText(
            startX + this._innerPadding,
            startY + this._innerPadding + item,
            highlight + this._menuItems[item]
        );
    }
};
Game.Screen.MenuScreen.prototype.handleInput = function(inputType, inputData) {
    var command = Game.Input.handleInput("MenuScreen", inputType, inputData);
    var unlock = command ? command() : false;

    // If the return value is true, unlock the engine (player turn over)
    if(unlock)
        this._player.getMap().getEngine().unlock();
    else
        Game.refresh();
};
Game.Screen.MenuScreen.prototype.executeOkFunction = function() {
    if(this._okFunction)
        return this._okFunction();
    else
        return false;
};
Game.Screen.MenuScreen.prototype.moveMenuIndex = function(amount) {
    this._currentIndex += amount;
}
