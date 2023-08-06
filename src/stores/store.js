import repl from '../views/editor/repl.js'
// console.log('ENVIRONMENT IS', process.env.NODE_ENV)
import Editor from '../views/EditorCm6.js'

import html from 'choo/html'
import Component from 'choo/component'

export default function store(state, emitter) {
  state.showInfo = false
  state.showUI = true
  state.showExtensions = false
  state.ui_components = []

  // if backend gallery endpoint supplied, then enable gallery functionality
  const SERVER_URL = import.meta.env.VITE_SERVER_URL
  state.serverURL = SERVER_URL !== undefined ? SERVER_URL : null


  emitter.on('load and eval code', (code, shouldUpdateURL = true) => {
    emitter.emit('editor: load code', code)
    emitter.emit('repl: eval', code)
    if(shouldUpdateURL) emitter.emit('gallery: save to URL', code)
  })

  emitter.on('repl: eval', (code = '', callback) => {
    window.html = html
    window.Component = Component
    window.cm = state.editor.editor.cm
    window.loadComponent = (code) => {
      const encodedJs = encodeURIComponent(code);
      const dataUri = 'data:text/javascript;charset=utf-8,'
        + encodedJs;
      
      import(/* @vite-ignore */dataUri).then(e=> {
        const component = e.default;
        state.ui_components.push(component)
        console.log("comp", component)
        emitter.emit("render")
      })
    }
    // document.querySelector("#hydra-ui").appendChild(html`<h1>hola</h1>`)
    // console.log(state.cache(Editor, 'editor').render(state))
    repl.eval(code, callback)
  })

  emitter.on('screencap', () => {
    screencap()
    const editor = state.editor.editor
    const text = editor.getValue()
    const data = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a')
    a.style.display = 'none'
    let d = new Date()
    a.download = `hydra-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}.${d.getMinutes()}.${d.getSeconds()}.js`
    a.href = URL.createObjectURL(data)
    a.click()

    setTimeout(() => {
      window.URL.revokeObjectURL(a.href);
    }, 300);
  })

  function clearAll() {
    const editor = state.editor.editor
    hush()
    speed = 1
    emitter.emit('gallery: clear')
    editor.clear()
  }

  emitter.on('clear all', () => {
    clearAll()
  })


  emitter.on('ui: hide all', function () {
    state.showUI = !state.showUI
    emitter.emit('render')
  })

  emitter.on('ui: toggle info', function (count) {
    if (state.showInfo) {
      // state.showInfo = false
      // state.showExtensions = false
      emitter.emit('ui: hide info')
    } else {
      emitter.emit('ui: show info')
    }
    // state.showInfo = !state.showInfo
    //emitter.emit('render')
  })

  emitter.on('ui: show info', () => {
    state.showInfo = true
    emitter.emit('render')
  })

  emitter.on('ui: hide info', () => {
    state.showInfo = false
    state.showExtensions = false
    emitter.emit('render')
  })

  // emitter.on('hide info', function (count) {
  //   state.showInfo = false
  //   state.showExtensions = false
  //   emitter.emit('render')
  // })

  emitter.on('ui: show extensions', () => {
    state.showExtensions = true
    state.showInfo = true
    emitter.emit('extensions: select category')
    emitter.emit('render')
  })

  emitter.on('ui: hide extensions', () => {
    state.showExtensions = false
    emitter.emit('render')
  })



  // emitter.on('mutate sketch', function () {

  // })
}

