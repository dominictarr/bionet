const riot = require('riot')
import bionetapi from '../bionetapi'
const MiniSignal = require('mini-signals')
var workbench = {
    init: function () {
        const thisModule = this

        BIONET.signal.getWorkbenchTreeResult = new MiniSignal()

        const getWorkbenchTree = function (root) {
            const cartData = []
            app.remote.workbenchTree(function (err, result) {

                // reconstruct inventory hierarchy sent as array as a single json object
                console.log('getWorkbenchTree result:', JSON.stringify(result), err)
                if (err) return console.error(err);
                var matches = [];
                const nodes = {};
                var q = ''
                var children = result
                const matchAll = (q === undefined || q.length === 0) ? true : false

                var rootNode = {
                    key: root.id,
                    title: 'workbench',
                    dbData: root,
                    parentId: root.parent_id,
                    children: []
                }
                nodes[root.id] = rootNode

                var i, cur, indent, a;
                for (i = 0; i < children.length; i++) {
                    cur = children[i].path;
                    if (cur.match(q) || matchAll) matches.push(cur);
                }

                var j, m, add, perfect;
                for (i = 0; i < children.length; i++) {
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
                        var coordinates = (data.parent_x !== undefined) ? ' (' + data.parent_x + ',' + data.parent_y + ')' : ''
                        var node = {
                            key: data.id,
                            title: title + coordinates,
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

                BIONET.signal.getWorkbenchTreeResult.dispatch(treeNodes)
            })
        }

        const requestWorkbench = function () {
            app.remote.getWorkbench(function (err, userWorkbench) {
                if (err) {
                    console.log('get workbench err:', err)
                    return
                }
                getWorkbenchTree(userWorkbench)
            })
        }
        BIONET.signal.requestWorkbench = new MiniSignal()
        BIONET.signal.requestWorkbench.add(requestWorkbench)

        const getFavorites = function () {
            app.remote.favLocationsTree(function (err, userFavorites) {
                if (err) {
                    console.log('get favorites err:', err)
                    return
                }
                BIONET.signal.getFavoritesResult.dispatch(userFavorites)
            })
        }
        BIONET.signal.getFavoritesResult = new MiniSignal()
        BIONET.signal.getFavorites = new MiniSignal()
        BIONET.signal.getFavorites.add(getFavorites)

        const saveInWorkbench = function (item) {
            console.log('saveInWorkbench, item:', JSON.stringify(item))
            app.remote.saveInWorkbench(item, null, false, function (err, result) {
                if (err) {
                    console.log('saveInWorkbench: err ', err)
                    app.ui.toast(err);
                    return;
                }
                requestWorkbench()
            })
        }

        const generatePhysicals = function (seriesName, instances) {
            const workbenchId = app.user.workbenchID
            const instancesList = []
            for (var instance = 0; instance < instances; instance++) {
                // todo: generate hash value for new physical instance to avoid naming collisions
                const name = seriesName + '_' + instance
                const dbData = {
                    name: name,
                    type: 'physical',
                    parent_id: workbenchId
                }
                instancesList.push(dbData)
                    //saveInWorkbench(dbData)
            }
            saveInWorkbench(instancesList)
        }.bind(this)
        BIONET.signal.generatePhysicals = new MiniSignal()
        BIONET.signal.generatePhysicals.add(generatePhysicals)

        const generatePhysicalsFromUpload = function (csvData) {
            const workbenchId = app.user.workbenchID
            console.log('generatePhysicalsFromUpload:', csvData)
            const instancesList = []
            const lines = csvData.match(/[^\r\n]+/g);

            const createVirtual = function (virtualObj, physicalInstances) {
                    if (!physicalInstances || isNaN(physicalInstances)) return
                    app.remote.saveVirtual(virtualObj, function (err, id) {
                        if (err) return app.ui.toast("Error: " + err) // TODO handle error
                        generatePhysicals(virtualObj.name, physicalInstances)
                    });
                }
                // line:["Name","Created By","Created","Description","Sequence","Physical Instances"]

            const headerLine = lines[0].match(/[^,]+/g)
            const nameIdx = headerLine.indexOf('Name')
            const typeIdx = headerLine.indexOf('Type')
            const usernameIdx = headerLine.indexOf('Created By')
            const createdDateIdx = headerLine.indexOf('Created')
            const descriptionIdx = headerLine.indexOf('Description')
            const sequenceIdx = headerLine.indexOf('Sequence')
            const instancesIdx = headerLine.indexOf('Physical Instances')
            const genomeIdx = headerLine.indexOf('Genome')
            if (nameIdx < 0 || typeIdx < 0 || instancesIdx < 0) {
                app.toast('invalid format specified, missing name, type or instances')
                return
            }

            for (var i = 1; i < lines.length; i++) {
                var line = lines[i].match(/[^,]+/g)
                console.log('line:%s', JSON.stringify(line))
                var instances = line[instancesIdx]
                if (!instances || isNaN(instances)) continue
                var seriesName = line[nameIdx]
                var userName = line[usernameIdx]
                var virtualType = line[typeIdx]
                    //const timeCreated = line[createdDateIdx]
                var timeCreated = new Date().toDateString()
                var creator = {
                    user: userName,
                    time: timeCreated
                }
                var updated = {
                    user: userName,
                    time: timeCreated
                }
                var description = line[descriptionIdx]
                var sequence = line[sequenceIdx]
                var genome = line[genomeIdx]
                var virtualObj = {
                    name: seriesName,
                    type: virtualType,
                    creator: creator,
                    "creator.user": userName,
                    "creator.time": timeCreated,
                    Description: description,
                    Sequence: sequence,
                    Genome: genome
                }
                createVirtual(virtualObj, instances)

                /*

                line:["Name","Created By","Created","Description","Sequence","Physical Instances"]

                getPhysicalResult {"name":"myNewVector01_0","type":"physical","parent_id":"p-40f35523-9884-4361-8eae-e97466e7b25d","id":"p-9820ba76-5ff0-4270-bbc3-07079a796b76","created":{"user":"tsakach@gmail.com","time":1499278758},"updated":{"user":"tsakach@gmail.com","time":1499278758}}

{"type":"vector","name":"myNewVector02","creator":{"user":"tsakach@gmail.com","time":"Wed Jul 05 2017"},"Description":"v02","Sequence":"abba","creator.user":"tsakach@gmail.com","creator.time":"Wed Jul 05 2017","Genotype":"abcd"}"
                */
                /*
                
                for (var instance = 0; instance < instances; instance++) {
                    const name = seriesName + '_' + instance
                    const dbData = {
                        name: name,
                        type: 'physical',
                        parent_id: workbenchId,
                        description: description,
                        sequence: sequence
                    }
                    instancesList.push(dbData)
                }
                */
            }
            saveInWorkbench(instancesList)
        }.bind(this)
        BIONET.signal.generatePhysicalsFromUpload = new MiniSignal()
        BIONET.signal.generatePhysicalsFromUpload.add(generatePhysicalsFromUpload)

        require('./workbench.tag.html')

        const workbenchRouter = function (q) {

            app.appbarConfig({
                enableTopNav: true,
                enableBreadCrumbs: true,
                enableSubbar: false
            })

            // todo: set inventory item
            app.setBreadcrumbs([{
                'label': 'workbench',
                'url': '/inventory'
            }]);
            riot.mount('div#content', 'inventory-treeview', {
                q: q
            })
        }
        route('/workbench', function () {
            workbenchRouter();
        })

        route('/workbench/*', function (q) {
            workbenchRouter(q);
        })
    },
    remove: function () {

    }
}
module.exports = workbench
