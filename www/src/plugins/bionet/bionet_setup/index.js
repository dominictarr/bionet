const riot = require('riot')
import bionetapi from '../bionetapi'
const MiniSignal = require('mini-signals')

require('./bionet-setup-storage.tag.html')
require('./bionet-setup-schemas.tag.html')
require('./bionet-setup-strains.tag.html')
require('./box-contents.tag.html')

var bionetSetup = {
    init: function () {

        const requestStorage = function (q) {
            app.remote.inventoryTree(function (err, children) {
                if (err) return console.error(err);

                var matches = [];
                //const nodes = [];
                const nodes = {};
                const matchAll = (q === undefined || q.length === 0) ? true : false

                var i, cur, indent, a;
                for (i = 0; i < children.length; i++) {
                    cur = children[i].path;
                    if (cur.match(q) || matchAll) matches.push(cur);
                }

                var j, m, add, perfect;
                for (i = 0; i < children.length; i++) {
                    // exclude physicals from inventory tree view
                    //if (children[i].value.type === 'physical') continue
                    cur = children[i].path;
                    a = cur.split('.');
                    indent = a.length - 1;
                    add = false
                    perfect = false
                    for (j = 0; j < matches.length; j++) {
                        m = matches[j];
                        if (m.indexOf(cur) === 0) {
                            add = true;
                            if (m.length === cur.length) perfect = true;
                            break;
                        }
                    }
                    if (add) {
                        const data = children[i].value
                            //console.log('inventory re value:', JSON.stringify(data))
                        var key = children[i].key
                        var parentId = data.parent_id
                            //var title = a[a.length - 1]
                        var title = data.name
                        var node = {
                            key: data.id,
                            title: title,
                            dbData: data,
                            notes: data.notes,
                            barcode: data.barcode,
                            parentId: parentId,
                            children: []
                        }
                        console.log('adding %s %s, parent %s', node.title, node.key, node.parentId)
                        nodes[data.id] = node
                    }
                }
                // pass two - add children to tree
                Object.keys(nodes).forEach(function (key, index) {
                        var node = nodes[key]
                        var parentId = node.parentId
                        if (parentId && nodes[parentId]) {
                            nodes[parentId].children.push(node)
                                //console.log('adding %s to %s',node.title,nodes[parentId].title)
                        }
                    })
                    //console.log('inventory step 1:', JSON.stringify(nodes,null,2))
                    // pass three - remove children from top level
                const treeNodes = []
                Object.keys(nodes).forEach(function (key, index) {
                        var node = nodes[key]
                        if (node.parentId === undefined) {
                            treeNodes.push(node)
                        }
                    })
                    //console.log('inventory step 2:', JSON.stringify(treeNodes,null,2))
                app.state.inventoryTree = treeNodes
                BIONET.signal.requestStorageResult.dispatch(treeNodes)
            });
        }
        BIONET.signal.requestStorageResult = new MiniSignal()
        BIONET.signal.requestStorage = new MiniSignal()
        BIONET.signal.requestStorage.add(requestStorage)

        const getBoxContents = function (id) {
            BIONET.remote.getChildren(id, function (err, children) {
                if (err) return console.error(err);
                BIONET.signal.getBoxContentsResult.dispatch(id, children)
            })
        }
        BIONET.signal.getBoxContentsResult = new MiniSignal()
        BIONET.signal.getBoxContents = new MiniSignal()
        BIONET.signal.getBoxContents.add(getBoxContents)

        const getContainerContents = function (id) {
            BIONET.remote.getChildren(id, function (err, children) {
                if (err) return console.error(err);
                BIONET.signal.getContainerContentsResult.dispatch(id, children)
            })
        }
        BIONET.signal.getContainerContentsResult = new MiniSignal()
        BIONET.signal.getContainerContents = new MiniSignal()
        BIONET.signal.getContainerContents.add(getContainerContents)

        const createStorageItem = function (storageItem) {
            console.log('createStorageItem:', JSON.stringify(storageItem))
            app.remote.savePhysical(storageItem, null, false, function (err, id) {
                if (err) {
                    console.log('createStorageItem error: %s', err)
                    if (cb) cb(err)
                    return;
                }
                console.log('createStorageItem saved, id:', id)
                const updatedStorageItem = JSON.parse(JSON.stringify(storageItem))
                updatedStorageItem.id = id
                BIONET.signal.createStorageItemResult.dispatch(updatedStorageItem)
            })
        }
        BIONET.signal.createStorageItemResult = new MiniSignal()
        BIONET.signal.createStorageItem = new MiniSignal()
        BIONET.signal.createStorageItem.add(createStorageItem)

        const addFavorite = function (m) {
            app.remote.saveFavLocation(m, null, null, function (err) {
                if (err) {
                    console.log('addFavorite error: %s', err)
                    return;
                }
                app.ui.toast(m.name + ' added to favorites');
                console.log('addFavorite id:', m.id)
            })
        }
        BIONET.signal.addFavorite = new MiniSignal()
        BIONET.signal.addFavorite.add(addFavorite)

        const getPhysical = function (id) {
            app.remote.get(id, function (err, data) {
                if (err) {
                    app.error(err)
                    return
                }
                BIONET.signal.getPhysicalResult.dispatch(data)
                    //const bionetStorageLocation = app.getStream('bionetStorageLocation')
                    //bionetStorageLocation.dispatch('configure', data.id)
            })
        }
        BIONET.signal.getPhysicalResult = new MiniSignal()
        BIONET.signal.getPhysical = new MiniSignal()
        BIONET.signal.getPhysical.add(getPhysical)
        BIONET.signal.physicalUpdated = new MiniSignal()

        const delPhysical = function (id) {
            console.log('delPhysical:', JSON.stringify(id))
            app.remote.delPhysical(id, function (err, cbid) {
                if (err) {
                    console.log('delPhysical error: %s', err)
                    if (cb) cb(err)
                    return;
                }
                console.log('delPhysical %s deleted', id)
            })
        }
        BIONET.signal.delPhysical = new MiniSignal()
        BIONET.signal.delPhysical.add(delPhysical)

        //todo: refactor
        const bionetSetup = app.addStreamRouter('bionetSetup')
        bionetSetup.addRoute('requestSchemas', function () {
                const schemaData = []
                const dataTypes = app.getAppSettings().dataTypes
                var key = 1
                for (var i = 0; i < dataTypes.length; i++) {
                    var dataType = dataTypes[i]
                    var node = {
                        title: dataType.name,
                        key: key.toString(),
                        type: '',
                        children: []
                    }
                    key++
                    var fields = app.getAttributesForType(dataType.name)
                    for (var j = 0; j < fields.length; j++) {
                        var field = fields[j]
                        var nodeType = {
                            title: field.name,
                            key: key.toString(),
                            type: field.value
                        }
                        key++
                        node.children.push(nodeType)
                    }
                    schemaData.push(node)
                }
                // TODO: messaging async api call
                bionetSetup.route('schemas', undefined, schemaData)
            })
            // process setup message
        bionetSetup.observe(function (setup) {
            return;
            console.log('bionetSetup:', JSON.stringify(setup))
            console.log('Configuring entity:', setup.entityName)
            var i
            console.log('creating layout items')

            for (i = 0; i < setup.labStorageLayout.length; i++) {
                const layoutItem = setup.labStorageLayout[i]
                console.log('\tcreating %s %s', layoutItem.type, layoutItem.name)
                    /*
                    app.remote.savePhysical(layoutItem, null, null, function (err, id) {
                        if (err) {
                            console.log('\terror creating %s %s Error:%s', layoutItem.type, layoutItem.name, err)
                        } else {
                            console.log('\tcreated %s %s', layoutItem.type, layoutItem.name)
                        }
                    })
                    */
            }

            console.log('creating schemas')
            for (i = 0; i < setup.schemas.length; i++) {
                const schema = setup.schemas[i]
                console.log('\tcreating %s', schema.name)
            }

            console.log('creating strains')
            for (i = 0; i < setup.strains.length; i++) {
                const strain = setup.strains[i]
                console.log('\tcreating %s', strain.name)
            }
        })

        app.editTextElement = function (e, active) {
            e.preventDefault();
            e.stopPropagation();
            const ARROW_LEFT = 37,
                ARROW_UP = 38,
                ARROW_RIGHT = 39,
                ARROW_DOWN = 40,
                ENTER = 13,
                ESC = 27,
                TAB = 9

            const activeOptions = {
                cloneProperties: ['top', 'left', 'padding', 'padding-bottom', 'padding-left', 'padding-right',
                        'text-align', 'font', 'font-size', 'font-family', 'font-weight',
                        'border', 'border-top', 'border-bottom', 'border-left', 'border-right'
                    ],
                editor: $('<input>')
            }

            const editor = activeOptions.editor.css('position', 'absolute').hide().appendTo(active.parent())

            const showEditor = function (select) {
                console.log('showEditor')
                    //.width(active.width())
                    //.width(parent.outerWidth()-active.position().left)
                    //const parent = active;
                const parent = active.parent();
                editor.val(active.text())
                    .removeClass('error')
                    .offset(active.offset())
                    .css(active.css(activeOptions.cloneProperties))
                    .width(parent.width())
                    .height(active.height())
                if (select) {
                    active.hide()
                    editor.show()
                    editor.focus()
                    editor.select();
                } else {
                    active.show();
                }
                active.css('cursor', 'pointer')
                active.keydown(function (e) {
                    console.log('active keydown ', e.which)
                    var prevent = true
                        //possibleMove = movement($(e.target), e.which);
                    var possibleMove
                    if (possibleMove.length > 0) {
                        possibleMove.focus();
                    } else if (e.which === ENTER) {
                        showEditor(false);
                    } else if (e.which === 17 || e.which === 91 || e.which === 93) {
                        showEditor(true);
                        prevent = false;
                    } else {
                        prevent = false;
                    }
                    if (prevent) {
                        e.stopPropagation();
                        e.preventDefault();
                    }
                });
            }
            const setActiveText = function () {
                var text = editor.val(),
                    evt = $.Event('change'),
                    originalContent;
                if (active.text() === text || editor.hasClass('error')) {
                    return true;
                }
                originalContent = active.html();
                active.text(text).trigger(evt, text);
                if (evt.result === false) {
                    active.html(originalContent);
                }
            }
            const movement = function (element, keycode) {
                if (keycode === ARROW_RIGHT) {
                    return element.next('td');
                } else if (keycode === ARROW_LEFT) {
                    return element.prev('td');
                } else if (keycode === ARROW_UP) {
                    return element.parent().prev().children().eq(element.index());
                } else if (keycode === ARROW_DOWN) {
                    return element.parent().next().children().eq(element.index());
                }
                return [];
            };
            editor.blur(function () {
                setActiveText();
                editor.remove();
                active.show();
            })
            editor.keydown(function (e) {
                console.log('editor keydown ', e.which)
                if (e.which === ENTER) {
                    setActiveText();
                    editor.hide();
                    active.show();
                    active.focus();
                    //e.preventDefault();
                    //e.stopPropagation();
                } else if (e.which === ESC) {
                    editor.val(active.text());
                    e.preventDefault();
                    e.stopPropagation();
                    editor.hide();
                    active.show();
                    active.focus();
                } else if (e.which === TAB) {
                    active.show();
                    active.focus();
                } else if (this.selectionEnd - this.selectionStart === this.value.length) {
                    /*
                    var possibleMove = movement(active, e.which);
                    if (possibleMove.length > 0) {
                        possibleMove.focus();
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    */
                }
            })
            editor.on('input paste', function () {
                var evt = $.Event('validate');
                active.trigger(evt, editor.val());
                if (evt.result === false) {
                    editor.addClass('error');
                } else {
                    editor.removeClass('error');
                }
            });
            showEditor(true)
        }


        // routes
        route('/bionetsetup/*', function (section) {
            const opts = {}
            var tagName = 'bionet-setup-storage'
            switch (section) {
                case 'storage':
                    tagName = 'bionet-setup-storage'
                    break;
                case 'schemas':
                    tagName = 'bionet-setup-schemas'
                    break;
                case 'strains':
                    tagName = 'bionet-setup-strains'
                    break;
            }
            riot.mount('div#content', tagName, opts)
        })
    },
    remove: function () {}
}
module.exports = bionetSetup
