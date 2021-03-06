const riot = require('riot')
import bionetapi from '../bionetapi'

var partsearch = {
    test: function() {
        console.log('calling test from search tag');
    },
    init: function () {

        //-------------------------------------------------------------------------
        // search
        require('./search-result.tag.html')
        require('./show-global-result.tag.html')

        // TODO are these still used?
        app.addStream('bioClassQuery')
        app.addStream('bioInstanceQuery')
        
        const bioPhysicalQuery = app.addStream('bioPhysicalQuery')
        const searchResult = app.addStreamRouter('searchResult')
        const searchCache = app.addStream('searchCache').init(undefined)
        const bioClassCache = app.addStream('bioClassCache').init(undefined)
        const bioInstanceCache = app.addStream('bioInstanceCache').init(undefined)

        bioPhysicalQuery.reduceRoute('toQueryItem', (m, partData) => {
            return {
                id: partData.datamatrix,
                name: partData.name,
                cassetteid: partData.cassetteid,
                locationid: partData.locationid
            }
        })

        searchResult.reduceRoute('toListItem', (m, partList) => {
            const convertItem = function (partData) {
                return {
                    primary_text: partData.name,
                    secondary_text: partData.id + ' ' + partData.cassetteid + ' ' + partData.locationid,
                    data: partData
                }
            }
            const listItem = []
            for (var i = 0; i < partList.length; i++) {
                listItem.push(convertItem(partList[i]))
            }
            return listItem
        })

        app.observe('bioPhysicalQuery', (q) => {
            app.remote.instancesOfVirtual(q, function (err, data) {
                // TODO: messaging async api call
                app.route('searchResult', 'updateList', 'toListItem', data)
            })
        })

        //---------------------------------------------------------------------
        // search route
        const localSearch = function (terms) {
            app.appbarConfig({
                enableTopNav: true,
                enableBreadCrumbs: true,
                enableSubbar: false
            })
            
            // todo: handle pagination
            const q = route.query()
            if (q.page !== undefined) {
                console.log('search result page: ' + q.page)
            }
            //const termsURL = (q.terms !== undefined) ? '?terms=' + q.terms : ''
            q.terms = (terms !== undefined) ? decodeURIComponent(terms) : ''
            if (q.terms.length<=0) {
                q.results=[]
                riot.mount('div#content', 'search-result', q)
                return
            }

            app.remote.search(q.terms, function (err, results) {

                if (err) return console.error(err); // TODO handle error better

                q.results = [];
                var i, result;
                for (i = 0; i < results.length; i++) {
                    //                        const result = results[i]._source
                    result = results[i];
                    if (!result || !result.name) continue;
                    console.log('result:', JSON.stringify(results[i]))
                    const isVirtual = result.id.charAt(0) === 'v'
                        //                        url: (isVirtual) ? '/edit/' + result.id : '/edit-physical/' + result.id,
                        //secondary_text: ((isVirtual) ? 'virtual' : 'physical') + ' id ' + result.id,

                    q.results.push({
                        primary_text: result.name,
                        secondary_text: '',
                        isPhysical: (result.id.indexOf('p-')>=0) ? true : false,
                        id: result.id
                    });
                }

                riot.mount('div#content', 'search-result', q)

            });
        }

        app.addRoute('/search', function () {
            localSearch()
        })
        app.addRoute('/search/*', function (terms) {
            localSearch(terms)
        })

        app.addRoute('/gsearch', function (terms) {
            globalSearch();
        })

        app.addRoute('/gsearch/*', function (terms) {
            globalSearch(terms);
        })

        // search route
        const globalSearch = function (terms) {
            app.appbarConfig({
                enableTopNav: true,
                enableBreadCrumbs: true,
                enableSubbar: false
            })
            
            // todo: handle pagination
            const q = route.query()
            if (q.page !== undefined) {
                console.log('search result page: ' + q.page)
            }

            q.terms = (terms !== undefined) ? decodeURIComponent(terms) : ''
            if (q.terms.length<=0) {
                q.results=[]
                riot.mount('div#content', 'search-result', q)
                return
            }

            console.log("SEARCHING FOR:", q.terms);

            q.results = [];
            q.global = true;

            riot.mount('div#content', 'search-result', q)

            var results = [];

            app.remote.peerSearch(q.terms, function (err, peerInfo, result) {
                if (err) return console.error(err); // TODO handle error better

              results.push({
                peer: peerInfo,
                result: result
              });

              riot.mount('div#searchresults', 'global-results', {results: results})
            });
        }
    },
    remove: function () {

    }
}
module.exports = partsearch
