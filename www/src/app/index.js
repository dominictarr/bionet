
var async = require('async');
import Plugin from './plugin';
import Persist from './persist'
import NanoStream from './NanoStream';
import NanoRoute from './NanoRoute';
const EventEmitter = require('events');
import search from './search'
var appSettings = require('../../../settings.js')();

var pluginsInitialized = false

class App extends EventEmitter {

  constructor() {
    super()
    
    // TODO globals should _only_ be assigned from main.js
    // and why does this var have two names? it should be called app, not BIONET
    // It was named BIONET because many js packages such as PIXI use this namespacing convention for global variables to avoid possible collisions when more generic global names are used.
    window.BIONET = this 
    
    this.state = {}

    this.remote = undefined // RPC connection to server
    this.user = undefined // currently logged in user

    this.login = undefined
    this.logout = undefined

    this.stream = {}
    this.signal = {}
    this.plugin = {}

    // built-in streams
    this.$ = {
      plugin: 'plugin',
      login: 'login',
      loginState: 'loginState',
      primaryNav: 'primaryNav',
      secondaryNav: 'secondaryNav',
      appBarConfig: 'appBarConfig',
      breadcrumbs: 'breadcrumbs',
      theme: 'theme',
      settings: 'settings',
      connectState: 'connectState'
    }

    this.ui = require('../ui/methods');
  }

  // initialize app
  initialize() {
    const thisModule = this

    // initialize local storage
    Persist.openDB()

    // plugin control stream
    this.addStream(this.$.plugin)


    // login data streams
    this.addStream(this.$.login)
    this.addStream(this.$.loginState, new NanoStream(false))

    // navigation data streams
    this.addStream(this.$.primaryNav)
    this.addStream(this.$.secondaryNav)

    // theme data streams
    this.addStream(this.$.appBarConfig)
    this.addStream(this.$.breadcrumbs)

    // connection state
    this.addStream(this.$.connectState)

    // initialize theme data stream
    const theme = this.addStream(this.$.theme)
    theme.reduce(function (m, b) {
      //todo: b.name should accept json path
      //note: method object containing functions is not stringify/parseable
      const newConfigStyle = JSON.parse(JSON.stringify(m.style))
      newConfigStyle[b.name] = b.value

      const newConfig = {
        style: newConfigStyle,
        method: m.method
      }
      return newConfig
    })

    // initialize settings data stream
    const settings = this.addStream(this.$.settings)
    settings.reduce(function (m, b) {
      const newSettings = JSON.parse(JSON.stringify(m))
      newSettings[b.setting] = b.value
      newSettings.lastUpdate = b
      return newSettings
    })
    settings.addObserver(function (newSettings) {
      console.log('storing settings:', JSON.stringify(newSettings))
      thisModule.putLocal(thisModule.$.settings, JSON.stringify(newSettings))
    })

  }

  search(query) {



  }

  // plugin methods
  addPlugin(name) {
    const newPlugin = new Plugin(name)
    this.plugin[name] = newPlugin
    return newPlugin
  }
  removePlugin(name) {
    plugin[name].remove()
    delete this.plugin[name];
  }

  // load settings and startup plugins 
  startPlugins(cb) {
    if (pluginsInitialized) return
    pluginsInitialized = true
    console.log('starting plugins...')
    const settings = this.getStream(this.$.settings)
    const thisModule = this

    // retrieve user settings from local storage or set default
    this.getLocal(this.$.settings, function (err, value) {
      var settingsObj = {}
      if (err) {
        //console.log('error reading userSettings:', err)
        // todo: encrypt/decript password in local storage
        settingsObj = {
          username: '',
          password: '',
          themeName: 'std',
          colorScheme: 'light'
        }
        thisModule.putLocal(thisModule.$.settings, JSON.stringify(settingsObj))
      } else {
        settingsObj = JSON.parse(value)
        //console.log('retrieved userSettings:', JSON.stringify(settingsObj))
      }
      settings.init(settingsObj)

      // TODO: messaging - plugins
      // TODO Shouldn't we have to wait for a callback here?
      // otherwise we might end up trying to use a plugin before it has loaded
//      thisModule.dispatch(thisModule.$.plugin, 'start')

      async.eachSeries(thisModule.plugin, function(plugin, cb) {
        console.log("############ starting", plugin.name);
        plugin.start(cb)
      }, cb);
    })
  }

  start() {
    this.startRouter()
    /*
    var interval = setInterval(function () {
      app.remote.foo('foo message', function (err) {
        console.log('foo message response')
      })
    }, 30 * 1000)
    */
  }

  // start router - after plugins have been started
  startRouter() {

    // mount root component
    console.log('mounting app tag:, riot=', riot)
    riot.mount('div#app', 'app')

    // initialize and start router
    route.base('/')
    route.start(true)

    console.log('app started')
  }

  // stream methods
  dispatch(name, message) {
    //console.log('dispatching to stream:',name)
    this.stream[name].dispatch(message);
  }

  route(router, address, mapper, message) {
    console.log('app.js routing %s to %s with mapper %s', address, router, mapper)
    this.stream[router].route(address, mapper, message)
  }

  observe(name, observer) {
    this.stream[name].observe(observer);
  }

  getStream(name) {
    return this.stream[name];
  }

  getModel(name) {
    //console.log('getModel:',name)
    return this.stream[name].getModel();
  }

  addObserver(name, observer) {
    console.log('addObserver:', name)
    this.stream[name].addObserver(observer);
    return observer;
  }

  removeObserver(name, observer) {
    //console.log('removeObserver:', name)
    this.stream[name].removeObserver(observer);
  }

  addStream(name, stream) {
    if (stream === undefined) stream = new NanoStream();
    console.log('addStream:',name)
    this.stream[name] = stream;
    return stream;
  }

  addStreamRouter(name, stream) {
    if (stream === undefined) stream = new NanoRoute();
    //console.log('addRoute:',name)
    this.stream[name] = stream;
    return stream;
  }

  addRouteDestination(router, address, f) {
    this.stream[router].addRoute(address, f)
  }

  removeRouteDestination(router, address) {
    this.stream[router].removeRoute(address);
  }

  initStream(name, state) {
    //console.log('init stream:', name, JSON.stringify(state))
    this.stream[name].init(state)
  }

  removeStream(name) {
    delete this.stream[name];
  }

  // local storage methods
  getLocal(key, cb) {
    Persist.get(key, cb)
  }

  putLocal(key, data, cb) {
    Persist.put(key, data, cb)
  }

  // todo: deprecated, remove when queries available
  readTestData(cb) {
    Persist.readTestData(cb)
  }

  // route methods
  addRoute(path, router) {
    route(path, router);
  }

  // settings methods
  getSettings() {
    return this.getModel(this.$.settings)
  }


  putSetting(property) {
    //console.log('putSettings:',JSON.stringify(property))
    this.dispatch(this.$.settings, property)
  }

  // login methods
  getLoginState() {
    return this.getModel(this.$.loginState)
  }

  setLoginState(user) {
    app.user = user;
    app.dispatch(app.$.loginState, !!user)
  }

  appbarConfig(config) {
    app.dispatch(app.$.appBarConfig, config)
  }

  setBreadcrumbs(breadcrumbs) {
    app.dispatch(app.$.breadcrumbs, breadcrumbs)
  }

  error(err) {
    app.dispatch('error', err)
  }
  
  setPrimaryNav(nav) {
    app.dispatch(app.$.primaryNav, nav)
  }
  
  setSecondaryNav(nav) {
    app.dispatch(app.$.secondaryNav, nav)
  }

  // theme methods
  getTheme() {
    return this.getModel(this.$.theme);
  }
  setTheme(theme) {
    app.dispatch(app.$.theme, theme)
  }

  getThemeMethod() {
    return this.getTheme().method;
  }
  getAppSettings() {
    return appSettings;
  }
  getType(type) {
    const dataTypes = appSettings.dataTypes
    for (var i = 0; i < dataTypes.length; i++) {
      const dataType = dataTypes[i]
      if (type === dataType.name) {
        return dataType
      }
    }
    return null
  }
  getAttributesForType(type) {

    const dataTypes = appSettings.dataTypes
    const attributes = []
    for (var i = 0; i < dataTypes.length; i++) {
      const dataType = dataTypes[i]
      if (type === dataType.name) {
        var fields = dataType.fields
        if (fields === undefined) return attributes
        Object.keys(fields).forEach(function (key, index) {
          attributes.push({
            name: key,
            value: fields[key]
          })
        })
        break
      }
    }
    return attributes
  }

};
export default new App();
